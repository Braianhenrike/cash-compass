import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { fetchAuditEvents, safeCreateAuditEvent } from "@/services/audit";
import type {
  Bill,
  BrickCost,
  BrickItem,
  Category,
  CategoryType,
  FinanceData,
  Income,
  MonthlyTarget,
  ScenarioConfig,
  Settings,
} from "@/types/finance";

type SettingsRow = Tables<"settings">;
type CategoryRow = Tables<"categories">;
type BillRow = Tables<"accounts_payable">;
type IncomeRow = Tables<"income_entries">;
type BrickRow = Tables<"brick_items">;
type BrickCostRow = Tables<"brick_costs">;
type MonthlyTargetRow = Tables<"monthly_targets">;
type ScenarioRow = Tables<"scenario_configs">;

const DEFAULT_SETTINGS: Settings = {
  minimum_cash_reserve: 500,
  currency: "BRL",
  default_scenario: "probable",
  alerts_enabled: true,
  stale_brick_days: 30,
  current_cash_balance: 2500,
  bill_due_alert_days: 3,
  default_bill_priority: "medium",
  goals_affect_cashflow: true,
  goals_reduce_month_bills: true,
  default_goal_day: 25,
  show_goals_on_projection_charts: true,
};

const DEFAULT_CATEGORIES: Array<{ type: CategoryType; name: string }> = [
  { type: "bill", name: "Moradia" },
  { type: "bill", name: "AlimentaÃ§Ã£o" },
  { type: "bill", name: "Transporte" },
  { type: "bill", name: "SaÃºde" },
  { type: "bill", name: "Lazer" },
  { type: "income", name: "Freelance" },
  { type: "income", name: "Emprego" },
  { type: "income", name: "Retorno" },
  { type: "brick", name: "EletrÃ´nicos" },
  { type: "brick", name: "Roupas" },
  { type: "brick", name: "ColecionÃ¡veis" },
];

const DEFAULT_SCENARIOS: Array<Omit<ScenarioConfig, "id">> = [
  { name: "conservative", sale_price_multiplier: 0.92, sale_delay_days: 10, expected_income_multiplier: 0.8 },
  { name: "probable", sale_price_multiplier: 1, sale_delay_days: 0, expected_income_multiplier: 1 },
  { name: "optimistic", sale_price_multiplier: 1.07, sale_delay_days: -5, expected_income_multiplier: 1.1 },
];

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function ensureData<T>(data: T | null, fallback: T) {
  return data ?? fallback;
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function changedKeys<T extends Record<string, unknown>>(patch: T) {
  return Object.keys(patch).filter((key) => patch[key] !== undefined);
}

function normalizeCategoryName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mapSettings(row: SettingsRow | null): Settings {
  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    minimum_cash_reserve: toNumber(row.minimum_cash_reserve),
    currency: row.currency,
    default_scenario: row.default_scenario,
    alerts_enabled: row.alerts_enabled,
    stale_brick_days: row.stale_brick_days,
    current_cash_balance: toNumber(row.current_cash_balance),
    bill_due_alert_days: row.bill_due_alert_days ?? DEFAULT_SETTINGS.bill_due_alert_days,
    default_bill_priority: row.default_bill_priority ?? DEFAULT_SETTINGS.default_bill_priority,
    goals_affect_cashflow: row.goals_affect_cashflow ?? DEFAULT_SETTINGS.goals_affect_cashflow,
    goals_reduce_month_bills: row.goals_reduce_month_bills ?? DEFAULT_SETTINGS.goals_reduce_month_bills,
    default_goal_day: row.default_goal_day ?? DEFAULT_SETTINGS.default_goal_day,
    show_goals_on_projection_charts:
      row.show_goals_on_projection_charts ?? DEFAULT_SETTINGS.show_goals_on_projection_charts,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
  };
}

function mapBill(row: BillRow): Bill {
  return {
    id: row.id,
    description: row.description,
    category_id: row.category_id,
    amount: toNumber(row.amount),
    due_date: row.due_date,
    paid_date: row.paid_date,
    is_recurring: row.is_recurring,
    recurrence_type: row.recurrence_type,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    type: row.type,
    category_id: row.category_id,
    description: row.description,
    amount: toNumber(row.amount),
    expected_date: row.expected_date,
    received_date: row.received_date,
    status: row.status,
    source: row.source,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapBrickCost(row: BrickCostRow): BrickCost {
  return {
    id: row.id,
    brick_item_id: row.brick_item_id,
    type: row.type,
    amount: toNumber(row.amount),
    notes: row.notes,
    created_at: row.created_at,
  };
}

function mapBrick(row: BrickRow, costs: BrickCost[]): BrickItem {
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    purchase_price: toNumber(row.purchase_price),
    target_sale_price: toNumber(row.target_sale_price),
    minimum_sale_price: toNumber(row.minimum_sale_price),
    probable_sale_price: toNumber(row.probable_sale_price),
    purchase_date: row.purchase_date,
    expected_sale_date: row.expected_sale_date,
    actual_sale_date: row.actual_sale_date,
    actual_sale_price: row.actual_sale_price === null ? null : toNumber(row.actual_sale_price),
    liquidity: row.liquidity,
    risk_level: row.risk_level,
    status: row.status,
    purchase_affects_cash_flow: row.purchase_affects_cash_flow ?? true,
    reserve_invested_capital: row.reserve_invested_capital ?? false,
    reserve_profit_for_reinvestment: row.reserve_profit_for_reinvestment ?? false,
    purchase_channel: row.purchase_channel,
    sales_channel: row.sales_channel,
    notes: row.notes,
    rating: row.rating,
    created_at: row.created_at,
    updated_at: row.updated_at,
    costs,
  };
}

function mapScenario(row: ScenarioRow): ScenarioConfig {
  return {
    id: row.id,
    name: row.name,
    sale_price_multiplier: toNumber(row.sale_price_multiplier),
    sale_delay_days: row.sale_delay_days,
    expected_income_multiplier: toNumber(row.expected_income_multiplier),
  };
}

async function ensureSettings(userId: string) {
  const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  throwIfError(error);

  if (data) {
    return mapSettings(data);
  }

  const insertPayload: TablesInsert<"settings"> = {
    user_id: userId,
    ...DEFAULT_SETTINGS,
  };
  const { data: inserted, error: insertError } = await supabase
    .from("settings")
    .insert(insertPayload)
    .select("*")
    .single();

  throwIfError(insertError);
  return mapSettings(inserted);
}

async function ensureCategories(userId: string) {
  const { data, error } = await supabase.from("categories").select("*").eq("user_id", userId);
  throwIfError(error);

  if (data && data.length > 0) {
    return data.map(mapCategory);
  }

  const payload: TablesInsert<"categories">[] = DEFAULT_CATEGORIES.map((category) => ({
    user_id: userId,
    ...category,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert(payload)
    .select("*");

  throwIfError(insertError);
  return ensureData(inserted, []).map(mapCategory);
}

async function ensureScenarios(userId: string) {
  const { data, error } = await supabase.from("scenario_configs").select("*").eq("user_id", userId);
  throwIfError(error);

  if (data && data.length > 0) {
    return data.map(mapScenario);
  }

  const payload: TablesInsert<"scenario_configs">[] = DEFAULT_SCENARIOS.map((scenario) => ({
    user_id: userId,
    ...scenario,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("scenario_configs")
    .insert(payload)
    .select("*");

  throwIfError(insertError);
  return ensureData(inserted, []).map(mapScenario);
}

export async function ensureUserBootstrap(userId: string) {
  const [settings, categories, scenarios] = await Promise.all([
    ensureSettings(userId),
    ensureCategories(userId),
    ensureScenarios(userId),
  ]);

  return { settings, categories, scenarios };
}

export async function fetchFinanceData(userId: string): Promise<FinanceData> {
  const bootstrap = await ensureUserBootstrap(userId);

  const [
    { data: billsData, error: billsError },
    { data: incomesData, error: incomesError },
    { data: bricksData, error: bricksError },
    { data: targetsData, error: targetsError },
    auditEvents,
  ] = await Promise.all([
    supabase.from("accounts_payable").select("*").eq("user_id", userId).order("due_date", { ascending: true }),
    supabase.from("income_entries").select("*").eq("user_id", userId).order("expected_date", { ascending: true }),
    supabase.from("brick_items").select("*").eq("user_id", userId).order("purchase_date", { ascending: false }),
    supabase.from("monthly_targets").select("*").eq("user_id", userId).order("month_ref", { ascending: true }),
    fetchAuditEvents(userId, 80),
  ]);

  throwIfError(billsError);
  throwIfError(incomesError);
  throwIfError(bricksError);
  throwIfError(targetsError);

  const brickIds = ensureData(bricksData, []).map((brick) => brick.id);
  const { data: costsData, error: costsError } =
    brickIds.length === 0
      ? { data: [] as BrickCostRow[], error: null }
      : await supabase.from("brick_costs").select("*").in("brick_item_id", brickIds).order("created_at", { ascending: true });
  throwIfError(costsError);

  const brickCostsById = new Map<string, BrickCost[]>();
  ensureData(costsData, []).forEach((cost) => {
    const mappedCost = mapBrickCost(cost);
    const bucket = brickCostsById.get(cost.brick_item_id) ?? [];
    bucket.push(mappedCost);
    brickCostsById.set(cost.brick_item_id, bucket);
  });

  return {
    settings: bootstrap.settings,
    categories: bootstrap.categories.sort((left, right) => left.name.localeCompare(right.name)),
    scenarios: bootstrap.scenarios,
    bills: ensureData(billsData, []).map(mapBill),
    incomes: ensureData(incomesData, []).map(mapIncome),
    bricks: ensureData(bricksData, []).map((brick) => mapBrick(brick, brickCostsById.get(brick.id) ?? [])),
    monthly_targets: ensureData(targetsData, []).map(mapMonthlyTarget),
    audit_events: auditEvents,
  };
}

function mapMonthlyTarget(row: MonthlyTargetRow): MonthlyTarget {
  return {
    id: row.id,
    month_ref: row.month_ref,
    title: row.title,
    type: row.type,
    amount: toNumber(row.amount),
    expected_date: row.expected_date,
    applies_to_cashflow: row.applies_to_cashflow,
    offsets_monthly_bills: row.offsets_monthly_bills,
    is_active: row.is_active,
    status: (row.status as MonthlyTarget["status"]) ?? "pending",
    completed_at: row.completed_at,
    recurrence_mode: row.recurrence_mode ?? "single",
    recurrence_weekdays: row.recurrence_weekdays ?? [],
    recurrence_occurrences: row.recurrence_occurrences,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateCurrentCash(userId: string, currentCashBalance: number, reason?: string) {
  const settings = await ensureSettings(userId);
  const previousBalance = settings.current_cash_balance;

  const payload: TablesUpdate<"settings"> = {
    user_id: userId,
    current_cash_balance: currentCashBalance,
  };
  const { error } = await supabase.from("settings").update(payload).eq("user_id", userId);
  throwIfError(error);

  const delta = Number((currentCashBalance - previousBalance).toFixed(2));
  const direction = delta > 0 ? "entrada" : delta < 0 ? "saida" : "ajuste";

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "settings",
    action: "update",
    summary: `Caixa ajustado de ${previousBalance} para ${currentCashBalance}.`,
    payload: {
      previous_balance: previousBalance,
      new_balance: currentCashBalance,
      delta,
      direction,
      reported_origin: reason?.trim() || null,
    },
  });
}

export async function updateSettings(userId: string, patch: Partial<Settings>) {
  const payload: TablesUpdate<"settings"> = {
    ...patch,
    user_id: userId,
  };
  const { error } = await supabase.from("settings").update(payload).eq("user_id", userId);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "settings",
    action: "update",
    summary: `Configuracoes atualizadas (${changedKeys(patch).join(", ") || "sem campos informados"}).`,
    payload: patch as Record<string, unknown>,
  });
}

export async function addCategory(userId: string, category: Omit<Category, "id">) {
  const payload: TablesInsert<"categories"> = {
    user_id: userId,
    type: category.type,
    name: category.name,
  };
  const { data, error } = await supabase.from("categories").insert(payload).select("id").single();
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "category",
    entity_id: data.id,
    action: "create",
    summary: `Categoria criada: ${category.name}.`,
    payload: category as Record<string, unknown>,
  });
}

export async function deleteCategory(categoryId: string) {
  const { data: categoryData, error: categoryLookupError } = await supabase
    .from("categories")
    .select("id, user_id, name, type")
    .eq("id", categoryId)
    .maybeSingle();
  throwIfError(categoryLookupError);

  if (!categoryData) {
    throw new Error("Categoria nao encontrada.");
  }

  const [
    { count: billCount, error: billsError },
    { count: incomeCount, error: incomesError },
    { count: brickCount, error: bricksError },
  ] = await Promise.all([
    supabase.from("accounts_payable").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
    supabase.from("income_entries").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
    supabase.from("brick_items").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
  ]);

  throwIfError(billsError);
  throwIfError(incomesError);
  throwIfError(bricksError);

  if ((billCount ?? 0) > 0 || (incomeCount ?? 0) > 0 || (brickCount ?? 0) > 0) {
    throw new Error("Essa categoria esta em uso. Reclassifique os registros antes de excluir.");
  }

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: categoryData.user_id,
    entity_type: "category",
    entity_id: categoryId,
    action: "delete",
    summary: `Categoria removida: ${categoryData.name}.`,
    payload: {
      type: categoryData.type,
    },
  });
}

export async function addBill(userId: string, bill: Omit<Bill, "id" | "created_at" | "updated_at">) {
  const payload: TablesInsert<"accounts_payable"> = {
    user_id: userId,
    ...bill,
  };
  const { data, error } = await supabase
    .from("accounts_payable")
    .insert(payload)
    .select("id, description")
    .single();
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "bill",
    entity_id: data.id,
    action: "create",
    summary: `Conta criada: ${data.description}.`,
    payload: bill as Record<string, unknown>,
  });
}

export async function updateBill(id: string, patch: Partial<Bill>) {
  const { data: existing, error: lookupError } = await supabase
    .from("accounts_payable")
    .select("id, user_id, description")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Conta nao encontrada.");
  }

  const payload: TablesUpdate<"accounts_payable"> = { ...patch };
  const { error } = await supabase.from("accounts_payable").update(payload).eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "bill",
    entity_id: id,
    action: "update",
    summary: `Conta atualizada: ${existing.description}.`,
    payload: patch as Record<string, unknown>,
  });
}

export async function deleteBill(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("accounts_payable")
    .select("id, user_id, description")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Conta nao encontrada.");
  }

  const { error } = await supabase.from("accounts_payable").delete().eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "bill",
    entity_id: id,
    action: "delete",
    summary: `Conta removida: ${existing.description}.`,
  });
}

export async function addIncome(userId: string, income: Omit<Income, "id" | "created_at" | "updated_at">) {
  const payload: TablesInsert<"income_entries"> = {
    user_id: userId,
    ...income,
  };
  const { data, error } = await supabase
    .from("income_entries")
    .insert(payload)
    .select("id, description")
    .single();
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "income",
    entity_id: data.id,
    action: "create",
    summary: `Entrada criada: ${data.description}.`,
    payload: income as Record<string, unknown>,
  });
}

export async function updateIncome(id: string, patch: Partial<Income>) {
  const { data: existing, error: lookupError } = await supabase
    .from("income_entries")
    .select("id, user_id, description")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Entrada nao encontrada.");
  }

  const payload: TablesUpdate<"income_entries"> = { ...patch };
  const { error } = await supabase.from("income_entries").update(payload).eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "income",
    entity_id: id,
    action: "update",
    summary: `Entrada atualizada: ${existing.description}.`,
    payload: patch as Record<string, unknown>,
  });
}

export async function deleteIncome(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("income_entries")
    .select("id, user_id, description")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Entrada nao encontrada.");
  }

  const { error } = await supabase.from("income_entries").delete().eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "income",
    entity_id: id,
    action: "delete",
    summary: `Entrada removida: ${existing.description}.`,
  });
}

export async function addBrick(userId: string, brick: Omit<BrickItem, "id" | "created_at" | "updated_at" | "costs">) {
  const payload: TablesInsert<"brick_items"> = {
    user_id: userId,
    ...brick,
  };
  const { data, error } = await supabase.from("brick_items").insert(payload).select("id, name").single();
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "brick",
    entity_id: data.id,
    action: "create",
    summary: `Brick criado: ${data.name}.`,
    payload: brick as Record<string, unknown>,
  });
}

export async function updateBrick(id: string, patch: Partial<BrickItem>) {
  const { data: existing, error: lookupError } = await supabase
    .from("brick_items")
    .select("id, user_id, name")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Brick nao encontrado.");
  }

  const payload: TablesUpdate<"brick_items"> = { ...patch };
  const { error } = await supabase.from("brick_items").update(payload).eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "brick",
    entity_id: id,
    action: "update",
    summary: `Brick atualizado: ${existing.name}.`,
    payload: patch as Record<string, unknown>,
  });
}

export async function deleteBrick(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("brick_items")
    .select("id, user_id, name")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Brick nao encontrado.");
  }

  const { error: deleteCostsError } = await supabase.from("brick_costs").delete().eq("brick_item_id", id);
  throwIfError(deleteCostsError);

  const { error } = await supabase.from("brick_items").delete().eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "brick",
    entity_id: id,
    action: "delete",
    summary: `Brick removido: ${existing.name}.`,
  });
}

export async function addBrickCost(brickId: string, cost: Omit<BrickCost, "id" | "brick_item_id">) {
  const { data: brickData, error: lookupError } = await supabase
    .from("brick_items")
    .select("id, user_id, name")
    .eq("id", brickId)
    .maybeSingle();
  throwIfError(lookupError);

  if (!brickData) {
    throw new Error("Brick nao encontrado para adicionar custo.");
  }

  const payload: TablesInsert<"brick_costs"> = {
    brick_item_id: brickId,
    ...cost,
  };
  const { error } = await supabase.from("brick_costs").insert(payload);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: brickData.user_id,
    entity_type: "brick",
    entity_id: brickId,
    action: "update",
    summary: `Custo adicional registrado em ${brickData.name}.`,
    payload: cost as Record<string, unknown>,
  });
}

export async function deleteBrickCost(costId: string) {
  const { data: costData, error: costLookupError } = await supabase
    .from("brick_costs")
    .select("id, brick_item_id, type, amount")
    .eq("id", costId)
    .maybeSingle();
  throwIfError(costLookupError);

  if (!costData) {
    throw new Error("Custo nao encontrado.");
  }

  const { data: brickData, error: brickLookupError } = await supabase
    .from("brick_items")
    .select("id, user_id, name")
    .eq("id", costData.brick_item_id)
    .maybeSingle();
  throwIfError(brickLookupError);

  const { error } = await supabase.from("brick_costs").delete().eq("id", costId);
  throwIfError(error);

  if (brickData) {
    await safeCreateAuditEvent({
      user_id: brickData.user_id,
      entity_type: "brick",
      entity_id: brickData.id,
      action: "update",
      summary: `Custo removido de ${brickData.name}.`,
      payload: {
        type: costData.type,
        amount: costData.amount,
      },
    });
  }
}

export async function addMonthlyTarget(userId: string, target: Omit<MonthlyTarget, "id" | "created_at" | "updated_at">) {
  const payload: TablesInsert<"monthly_targets"> = {
    user_id: userId,
    ...target,
  };
  const { data, error } = await supabase
    .from("monthly_targets")
    .insert(payload)
    .select("id, title, month_ref")
    .single();
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "monthly_target",
    entity_id: data.id,
    action: "create",
    summary: `Meta mensal criada: ${data.title} (${data.month_ref}).`,
    payload: target as Record<string, unknown>,
  });
}

export async function addMonthlyTargets(userId: string, targets: Array<Omit<MonthlyTarget, "id" | "created_at" | "updated_at">>) {
  if (targets.length === 0) {
    return;
  }

  const payload: TablesInsert<"monthly_targets">[] = targets.map((target) => ({
    user_id: userId,
    ...target,
  }));
  const { data, error } = await supabase
    .from("monthly_targets")
    .insert(payload)
    .select("id, title, month_ref, expected_date");
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: userId,
    entity_type: "monthly_target",
    action: "create",
    summary: `${targets.length} meta(s) mensal(is) criada(s).`,
    payload: {
      count: targets.length,
      entries: (data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        month_ref: item.month_ref,
        expected_date: item.expected_date,
      })),
    },
  });
}

export async function updateMonthlyTarget(id: string, patch: Partial<MonthlyTarget>) {
  const { data: existing, error: lookupError } = await supabase
    .from("monthly_targets")
    .select("id, user_id, title, month_ref")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Meta mensal nao encontrada.");
  }

  const payload: TablesUpdate<"monthly_targets"> = { ...patch };
  const { error } = await supabase.from("monthly_targets").update(payload).eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "monthly_target",
    entity_id: id,
    action: "update",
    summary: `Meta mensal atualizada: ${existing.title} (${existing.month_ref}).`,
    payload: patch as Record<string, unknown>,
  });
}

export async function completeMonthlyTarget(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("monthly_targets")
    .select("id, user_id, title, month_ref, expected_date, status")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Meta mensal nao encontrada.");
  }

  const completedAt = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("monthly_targets")
    .update({
      status: "completed",
      completed_at: completedAt,
      expected_date: existing.expected_date ?? completedAt,
    })
    .eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "monthly_target",
    entity_id: id,
    action: "update",
    summary: `Meta mensal marcada como batida: ${existing.title}.`,
    payload: {
      status: "completed",
      completed_at: completedAt,
    },
  });
}

export async function reopenMonthlyTarget(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("monthly_targets")
    .select("id, user_id, title, month_ref")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Meta mensal nao encontrada.");
  }

  const { error } = await supabase
    .from("monthly_targets")
    .update({
      status: "pending",
      completed_at: null,
    })
    .eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "monthly_target",
    entity_id: id,
    action: "update",
    summary: `Meta mensal reaberta: ${existing.title}.`,
    payload: {
      status: "pending",
      completed_at: null,
    },
  });
}

export async function deleteMonthlyTarget(id: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("monthly_targets")
    .select("id, user_id, title, month_ref")
    .eq("id", id)
    .maybeSingle();
  throwIfError(lookupError);

  if (!existing) {
    throw new Error("Meta mensal nao encontrada.");
  }

  const { error } = await supabase.from("monthly_targets").delete().eq("id", id);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: existing.user_id,
    entity_type: "monthly_target",
    entity_id: id,
    action: "delete",
    summary: `Meta mensal removida: ${existing.title} (${existing.month_ref}).`,
  });
}

export async function updateScenarioConfig(
  scenarioId: string,
  patch: Partial<Omit<ScenarioConfig, "id" | "name">>,
) {
  const { data: scenarioData, error: lookupError } = await supabase
    .from("scenario_configs")
    .select("id, user_id, name")
    .eq("id", scenarioId)
    .maybeSingle();
  throwIfError(lookupError);

  if (!scenarioData) {
    throw new Error("Cenario nao encontrado.");
  }

  const payload: TablesUpdate<"scenario_configs"> = { ...patch };
  const { error } = await supabase.from("scenario_configs").update(payload).eq("id", scenarioId);
  throwIfError(error);

  await safeCreateAuditEvent({
    user_id: scenarioData.user_id,
    entity_type: "scenario",
    entity_id: scenarioId,
    action: "update",
    summary: `Cenario ${scenarioData.name} atualizado.`,
    payload: patch as Record<string, unknown>,
  });
}


