import { addDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { safeCreateAuditEvent } from "@/services/audit";
import type {
  CategoryType,
  ImportExecutionOptions,
  ImportExecutionResult,
  ImportPreview,
  ImportedTemplateEntry,
  IncomeStatus,
  IncomeType,
} from "@/types/finance";

const IMPORT_NOTE_PREFIX = "[import-planilha]";

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function inferImportedIncomeType(label: string): IncomeType {
  const normalized = normalizeLabel(label);
  if (normalized.includes("salario") || normalized.includes("vale")) {
    return "salary";
  }
  if (normalized.includes("retorno")) {
    return "investment_return";
  }
  return "side_hustle";
}

function buildImportedStatus(date: string): { billStatus: "pending" | "paid"; incomeStatus: IncomeStatus; receivedDate: string | null; paidDate: string | null } {
  const today = new Date();
  const target = parseISO(date);
  const isPast = target < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return {
    billStatus: isPast ? "paid" : "pending",
    incomeStatus: isPast ? "received" : "expected",
    receivedDate: isPast ? date : null,
    paidDate: isPast ? date : null,
  };
}

async function ensureCategory(userId: string, type: CategoryType, name: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("name", name)
    .maybeSingle();

  throwIfError(error);

  if (data?.id) {
    return data.id;
  }

  const payload: TablesInsert<"categories"> = {
    user_id: userId,
    type,
    name,
  };
  const { data: inserted, error: insertError } = await supabase.from("categories").insert(payload).select("id").single();
  throwIfError(insertError);
  return inserted.id;
}

async function replaceExistingImports(userId: string) {
  const { data: importedBricks, error: importedBricksError } = await supabase
    .from("brick_items")
    .select("id")
    .eq("user_id", userId)
    .like("notes", `${IMPORT_NOTE_PREFIX}%`);
  throwIfError(importedBricksError);

  const importedBrickIds = (importedBricks ?? []).map((brick) => brick.id);
  if (importedBrickIds.length > 0) {
    const { error: costDeleteError } = await supabase.from("brick_costs").delete().in("brick_item_id", importedBrickIds);
    throwIfError(costDeleteError);
  }

  const [{ error: billError }, { error: incomeError }, { error: brickError }] = await Promise.all([
    supabase.from("accounts_payable").delete().eq("user_id", userId).like("notes", `${IMPORT_NOTE_PREFIX}%`),
    supabase.from("income_entries").delete().eq("user_id", userId).like("notes", `${IMPORT_NOTE_PREFIX}%`),
    supabase.from("brick_items").delete().eq("user_id", userId).like("notes", `${IMPORT_NOTE_PREFIX}%`),
  ]);

  throwIfError(billError);
  throwIfError(incomeError);
  throwIfError(brickError);
}

function sanitizeImportedLabel(entry: ImportedTemplateEntry) {
  return entry.kind === "income" ? entry.label.split("__")[0] : entry.label;
}

function buildImportedNote(note: string) {
  const trimmed = note.trim();
  return trimmed ? `${IMPORT_NOTE_PREFIX} ${trimmed}` : IMPORT_NOTE_PREFIX;
}

export async function executeTemplateImport(
  userId: string,
  preview: ImportPreview,
  options: ImportExecutionOptions,
): Promise<ImportExecutionResult> {
  if (options.replace_existing_imports) {
    await replaceExistingImports(userId);
  }

  const [incomeCategoryId, billCategoryId, brickCategoryId] = await Promise.all([
    ensureCategory(userId, "income", "Importado"),
    ensureCategory(userId, "bill", "Importado"),
    ensureCategory(userId, "brick", "Importado"),
  ]);

  const billPayload: TablesInsert<"accounts_payable">[] = [];
  const incomePayload: TablesInsert<"income_entries">[] = [];
  const brickPayload: TablesInsert<"brick_items">[] = [];

  preview.entries.forEach((entry) => {
    const status = buildImportedStatus(entry.date);
    const cleanLabel = sanitizeImportedLabel(entry);

    if (entry.kind === "bill") {
      billPayload.push({
        user_id: userId,
        description: cleanLabel,
        category_id: billCategoryId,
        amount: entry.amount,
        due_date: entry.date,
        paid_date: status.paidDate,
        is_recurring: false,
        recurrence_type: "none",
        priority: "medium",
        status: status.billStatus,
        notes: buildImportedNote(entry.notes),
      });
      return;
    }

    if (entry.kind === "income") {
      incomePayload.push({
        user_id: userId,
        type: inferImportedIncomeType(entry.label),
        category_id: incomeCategoryId,
        description: cleanLabel,
        amount: entry.amount,
        expected_date: entry.date,
        received_date: status.receivedDate,
        status: status.incomeStatus,
        source: "Importacao Excel",
        notes: buildImportedNote(entry.notes),
      });
      return;
    }

    brickPayload.push({
      user_id: userId,
      name: `${cleanLabel} - ${entry.month_label}/${preview.base_year}`,
      category_id: brickCategoryId,
      purchase_price: entry.amount,
      target_sale_price: entry.amount,
      minimum_sale_price: entry.amount,
      probable_sale_price: entry.amount,
      purchase_date: entry.date,
      expected_sale_date: format(addDays(parseISO(entry.date), 30), "yyyy-MM-dd"),
      actual_sale_date: null,
      actual_sale_price: null,
      liquidity: "medium",
      risk_level: "medium",
      status: "planned",
      purchase_channel: "Importacao Excel",
      sales_channel: "A definir",
      notes: `${buildImportedNote(entry.notes)} Ajuste o retorno esperado depois da importacao.`,
      rating: null,
    });
  });

  if (billPayload.length > 0) {
    const { error } = await supabase.from("accounts_payable").insert(billPayload);
    throwIfError(error);
  }

  if (incomePayload.length > 0) {
    const { error } = await supabase.from("income_entries").insert(incomePayload);
    throwIfError(error);
  }

  if (brickPayload.length > 0) {
    const { error } = await supabase.from("brick_items").insert(brickPayload);
    throwIfError(error);
  }

  let updatedCurrentCash = false;
  if (options.update_current_cash_from_sheet && preview.summary.last_cash_balance !== null) {
    const settingsPatch: TablesUpdate<"settings"> = {
      current_cash_balance: preview.summary.last_cash_balance,
    };
    const { error } = await supabase.from("settings").update(settingsPatch).eq("user_id", userId);
    throwIfError(error);
    updatedCurrentCash = true;
  }

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "import",
    action: "import",
    summary: `Importacao de planilha concluida: ${preview.summary.income_count} entradas, ${preview.summary.bill_count} contas e ${preview.summary.planned_investment_count} aportes planejados.`,
    payload: {
      file_sheet: preview.sheet_name,
      base_year: preview.base_year,
      ...preview.summary,
      options,
    },
  });

  return {
    created_bills: billPayload.length,
    created_incomes: incomePayload.length,
    created_bricks: brickPayload.length,
    updated_current_cash: updatedCurrentCash,
  };
}
