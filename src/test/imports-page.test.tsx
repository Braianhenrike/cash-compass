import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportsPage from "@/pages/ImportsPage";
import type { AuditEvent, ImportPreview, Settings } from "@/types/finance";

const importTemplateMock = vi.fn();
const parseBudgetTemplateFileMock = vi.fn();

vi.mock("@/stores/financeStore", () => ({
  useFinanceStore: () => ({
    settings: {
      minimum_cash_reserve: 500,
      currency: "BRL",
      default_scenario: "probable",
      alerts_enabled: true,
      stale_brick_days: 30,
      current_cash_balance: 1200,
      bill_due_alert_days: 3,
      default_bill_priority: "medium",
      goals_affect_cashflow: true,
      goals_reduce_month_bills: true,
      default_goal_day: 25,
    } satisfies Settings,
    importTemplate: importTemplateMock,
    auditEvents: [
      {
        id: "audit-1",
        entity_type: "import",
        entity_id: null,
        action: "import",
        summary: "Importacao anterior concluida.",
        payload: null,
        created_at: "2026-04-01T10:00:00.000Z",
      } satisfies AuditEvent,
    ],
    isSyncing: false,
  }),
}));

vi.mock("@/lib/importers/excelBudgetImport", () => ({
  parseBudgetTemplateFile: (...args: unknown[]) => parseBudgetTemplateFileMock(...args),
}));

describe("ImportsPage", () => {
  const preview: ImportPreview = {
    base_year: 2026,
    sheet_name: "Controle",
    entries: [
      {
        id: "income-1",
        kind: "income",
        label: "Salario__salary",
        amount: 5000,
        month_label: "abril",
        date: "2026-04-01",
        day: 1,
        source_row: 2,
        notes: "Entrada importada.",
      },
      {
        id: "bill-1",
        kind: "bill",
        label: "Aluguel",
        amount: 1600,
        month_label: "abril",
        date: "2026-04-10",
        day: 10,
        source_row: 10,
        notes: "Conta importada.",
      },
    ],
    monthly_balances: [
      {
        month_label: "abril",
        month_number: 4,
        monthly_result: 500,
        cash_balance: 1700,
      },
    ],
    summary: {
      income_count: 1,
      bill_count: 1,
      planned_investment_count: 0,
      total_income: 5000,
      total_bills: 1600,
      total_planned_investment: 0,
      last_cash_balance: 1700,
    },
  };

  beforeEach(() => {
    importTemplateMock.mockReset();
    parseBudgetTemplateFileMock.mockReset();
    importTemplateMock.mockResolvedValue({
      created_bills: 1,
      created_incomes: 1,
      created_bricks: 0,
      updated_current_cash: true,
    });
    parseBudgetTemplateFileMock.mockResolvedValue(preview);
  });

  it("gera preview da planilha e confirma importacao", async () => {
    render(<ImportsPage />);

    const file = new File(["conteudo"], "controle.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(screen.getByLabelText("Arquivo"), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Gerar pre-visualizacao" }));

    await screen.findByText("Conferencia mensal");
    expect(screen.getByText("Importacao anterior concluida.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar importacao" }));

    await waitFor(() => {
      expect(importTemplateMock).toHaveBeenCalledWith(preview, {
        replace_existing_imports: true,
        update_current_cash_from_sheet: true,
      });
    });
  }, 15000);
});
