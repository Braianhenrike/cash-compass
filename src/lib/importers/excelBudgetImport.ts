import { endOfMonth, format } from "date-fns";

import type {
  ImportPreview,
  ImportedEntryKind,
  ImportedMonthlyBalance,
  ImportedTemplateEntry,
  IncomeType,
} from "@/types/finance";

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "-" || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDay(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{1,2}/);
  return match ? Number(match[0]) : null;
}

function clampDay(year: number, monthNumber: number, day: number | null) {
  const targetDay = day ?? 1;
  const monthEnd = endOfMonth(new Date(year, monthNumber - 1, 1)).getDate();
  return Math.min(monthEnd, Math.max(1, targetDay));
}

function buildDate(year: number, monthNumber: number, day: number | null) {
  return format(new Date(year, monthNumber - 1, clampDay(year, monthNumber, day)), "yyyy-MM-dd");
}

function inferIncomeType(label: string): IncomeType {
  if (label.includes("salario") || label.includes("vale")) {
    return "salary";
  }
  if (label.includes("retorno")) {
    return "investment_return";
  }
  return "side_hustle";
}

function makeEntry(
  kind: ImportedEntryKind,
  label: string,
  amount: number,
  monthLabel: string,
  date: string,
  sourceRow: number,
  day: number | null,
  notes: string,
): ImportedTemplateEntry {
  return {
    id: `${kind}-${sourceRow}-${monthLabel}-${label}`,
    kind,
    label,
    amount,
    month_label: monthLabel,
    date,
    day,
    source_row: sourceRow,
    notes,
  };
}

function extractMonthColumns(rows: unknown[][]) {
  const monthColumns: Array<{ index: number; label: string; monthNumber: number }> = [];

  for (let rowIndex = 0; rowIndex < Math.min(3, rows.length); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    row.forEach((cell, columnIndex) => {
      const normalized = normalizeText(cell);
      const monthNumber = MONTHS[normalized];
      if (!monthNumber || monthColumns.some((item) => item.index === columnIndex)) {
        return;
      }

      monthColumns.push({
        index: columnIndex,
        label: normalized,
        monthNumber,
      });
    });
  }

  return monthColumns.sort((left, right) => left.index - right.index);
}

export function parseBudgetTemplateRows(rows: unknown[][], baseYear: number, sheetName = "Planilha"): ImportPreview {
  const monthColumns = extractMonthColumns(rows);
  const entries: ImportedTemplateEntry[] = [];
  const monthlyBalances = new Map<string, ImportedMonthlyBalance>();
  let section: "income" | "bill" | null = null;

  rows.forEach((row, index) => {
    const labelRaw = row[0];
    const label = String(labelRaw ?? "").trim();
    const normalizedLabel = normalizeText(labelRaw);

    if (!label) {
      return;
    }

    if (normalizedLabel.includes("salario")) {
      section = "income";
      return;
    }

    if (normalizedLabel.includes("total de entradas")) {
      section = "bill";
      return;
    }

    if (normalizedLabel === "entradas") {
      return;
    }

    if (normalizedLabel.includes("total de gastos")) {
      return;
    }

    if (normalizedLabel.includes("saldo mensal")) {
      monthColumns.forEach(({ index: columnIndex, label: monthLabel, monthNumber }) => {
        const value = numericValue(row[columnIndex]);
        const current = monthlyBalances.get(monthLabel) ?? {
          month_label: monthLabel,
          month_number: monthNumber,
          monthly_result: null,
          cash_balance: null,
        };
        monthlyBalances.set(monthLabel, { ...current, monthly_result: value });
      });
      return;
    }

    if (normalizedLabel.includes("saldo em dinheiro")) {
      monthColumns.forEach(({ index: columnIndex, label: monthLabel, monthNumber }) => {
        const value = numericValue(row[columnIndex]);
        const current = monthlyBalances.get(monthLabel) ?? {
          month_label: monthLabel,
          month_number: monthNumber,
          monthly_result: null,
          cash_balance: null,
        };
        monthlyBalances.set(monthLabel, { ...current, cash_balance: value });
      });
      return;
    }

    if (normalizedLabel.includes("investir")) {
      monthColumns.forEach(({ index: columnIndex, label: monthLabel, monthNumber }) => {
        const value = numericValue(row[columnIndex]);
        if (!value || value <= 0) {
          return;
        }
        entries.push(
          makeEntry(
            "planned_investment",
            "Aporte importado da planilha",
            value,
            monthLabel,
            buildDate(baseYear, monthNumber, 1),
            index + 1,
            1,
            "[import-planilha] Aporte planejado importado da linha Investir.",
          ),
        );
      });
      return;
    }

    if (section === "income") {
      monthColumns.forEach(({ index: columnIndex, label: monthLabel, monthNumber }) => {
        const value = numericValue(row[columnIndex]);
        if (!value || value <= 0) {
          return;
        }
        const type = inferIncomeType(normalizedLabel);
        entries.push(
          makeEntry(
            "income",
            `${label}__${type}`,
            value,
            monthLabel,
            buildDate(baseYear, monthNumber, 1),
            index + 1,
            1,
            `[import-planilha] Entrada importada da planilha para ${label}.`,
          ),
        );
      });
      return;
    }

    if (section === "bill") {
      const dueDay = parseDay(row[1]);
      const baseNotes = dueDay
        ? `[import-planilha] Conta importada da planilha com vencimento no dia ${dueDay}.`
        : "[import-planilha] Conta importada da planilha sem dia definido; vencimento assumido no dia 1.";

      monthColumns.forEach(({ index: columnIndex, label: monthLabel, monthNumber }) => {
        const value = numericValue(row[columnIndex]);
        if (!value || value <= 0) {
          return;
        }
        entries.push(
          makeEntry(
            "bill",
            label,
            value,
            monthLabel,
            buildDate(baseYear, monthNumber, dueDay),
            index + 1,
            dueDay,
            baseNotes,
          ),
        );
      });
    }
  });

  const balances = [...monthlyBalances.values()].sort((left, right) => left.month_number - right.month_number);
  const summary = {
    income_count: entries.filter((entry) => entry.kind === "income").length,
    bill_count: entries.filter((entry) => entry.kind === "bill").length,
    planned_investment_count: entries.filter((entry) => entry.kind === "planned_investment").length,
    total_income: entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0),
    total_bills: entries.filter((entry) => entry.kind === "bill").reduce((sum, entry) => sum + entry.amount, 0),
    total_planned_investment: entries
      .filter((entry) => entry.kind === "planned_investment")
      .reduce((sum, entry) => sum + entry.amount, 0),
    last_cash_balance: balances.filter((item) => item.cash_balance !== null).at(-1)?.cash_balance ?? null,
  };

  return {
    base_year: baseYear,
    sheet_name: sheetName,
    entries,
    monthly_balances: balances,
    summary,
  };
}

export async function parseBudgetTemplateFile(file: File, baseYear: number) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  return parseBudgetTemplateRows(rows, baseYear, sheetName);
}
