import { describe, expect, it } from "vitest";

import { parseBudgetTemplateRows } from "@/lib/importers/excelBudgetImport";

describe("excel budget import", () => {
  it("mapeia entradas, contas, aportes e saldos do template mensal", () => {
    const rows: unknown[][] = [
      ["SALÁRIO", "DATA", "abril", "maio", "junho"],
      ["Vale alimentação", null, "1.280", "1.280", "1.280"],
      ["AlphaSports", null, 30, 30, 30],
      ["Total de Entradas", null, "1.310", "1.310", "1.310"],
      ["telefone", "05/", 70, 70, 70],
      ["aluguel", "10/", 1676, 1676, 1676],
      ["Total de Gastos", null, 1746, 1746, 1746],
      ["SALDO MENSAL", null, -436, -436, -436],
      ["Investir", null, null, 3000, 3000],
      ["SALDO EM DINHEIRO", null, -1364, 192, 78],
    ];

    const preview = parseBudgetTemplateRows(rows, 2026, "Controle");

    expect(preview.sheet_name).toBe("Controle");
    expect(preview.summary.income_count).toBe(6);
    expect(preview.summary.bill_count).toBe(6);
    expect(preview.summary.planned_investment_count).toBe(2);
    expect(preview.summary.last_cash_balance).toBe(78);
    expect(preview.entries.find((entry) => entry.kind === "bill")?.date).toBe("2026-04-05");
    expect(preview.entries.find((entry) => entry.kind === "planned_investment")?.date).toBe("2026-05-01");
    expect(preview.monthly_balances).toHaveLength(3);
  });
});
