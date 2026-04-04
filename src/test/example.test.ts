import { describe, expect, it } from "vitest";
import { format } from "date-fns";

import {
  buildSimulationResult,
  buildReportSnapshot,
  calcBrickReserveProjection,
  calcBrickMetrics,
  calcCashSummary,
  calcDailyProjections,
  generateAlerts,
  normalizeBillStatus,
  suggestSales,
} from "@/lib/calculations";
import { materializeMonthlyTargetDraft } from "@/lib/monthlyTargets";
import type { Bill, BrickItem, Category, Income, MonthlyTarget, ScenarioConfig, Settings } from "@/types/finance";

const settings: Settings = {
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
  show_goals_on_projection_charts: true,
};

const scenarios: ScenarioConfig[] = [
  {
    id: "scenario-probable",
    name: "probable",
    sale_price_multiplier: 1,
    sale_delay_days: 0,
    expected_income_multiplier: 1,
  },
];

const categories: Category[] = [
  { id: "cat-bill", type: "bill", name: "Moradia" },
  { id: "cat-income", type: "income", name: "Freelance" },
  { id: "cat-brick", type: "brick", name: "Eletronicos" },
];

function localDateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return format(date, "yyyy-MM-dd");
}

const bills: Bill[] = [
  {
    id: "bill-1",
    description: "Aluguel",
    category_id: null,
    amount: 900,
    due_date: localDateOffset(1),
    paid_date: null,
    is_recurring: true,
    recurrence_type: "monthly",
    priority: "critical",
    status: "pending",
    notes: "",
    created_at: new Date().toISOString(),
  },
];

const incomes: Income[] = [
  {
    id: "income-1",
    type: "side_hustle",
    category_id: null,
    description: "Freela",
    amount: 500,
    expected_date: localDateOffset(1),
    received_date: null,
    status: "confirmed",
    source: "Cliente",
    notes: "",
    created_at: new Date().toISOString(),
  },
];

const bricks: BrickItem[] = [
  {
    id: "brick-1",
    name: "Celular",
    category_id: null,
    purchase_price: 700,
    target_sale_price: 1100,
    minimum_sale_price: 950,
    probable_sale_price: 1000,
    purchase_date: localDateOffset(-5),
    expected_sale_date: localDateOffset(2),
    actual_sale_date: null,
    actual_sale_price: null,
    liquidity: "high",
    risk_level: "low",
    status: "listed",
    purchase_affects_cash_flow: true,
    reserve_invested_capital: false,
    reserve_profit_for_reinvestment: false,
    purchase_channel: "Loja",
    sales_channel: "Marketplace",
    notes: "",
    rating: null,
    created_at: new Date().toISOString(),
    costs: [
      {
        id: "cost-1",
        brick_item_id: "brick-1",
        type: "shipping",
        amount: 50,
        notes: "",
      },
    ],
  },
];

const monthlyTargets: MonthlyTarget[] = [
  {
    id: "target-1",
    month_ref: `${localDateOffset(0).slice(0, 7)}-01`,
    title: "Meta side hustle do mes",
    type: "side_hustle_goal",
    amount: 900,
    expected_date: localDateOffset(2),
    applies_to_cashflow: true,
    offsets_monthly_bills: true,
    is_active: true,
    status: "pending",
    completed_at: null,
    recurrence_mode: "single",
    recurrence_weekdays: [],
    recurrence_occurrences: null,
    notes: "",
    created_at: new Date().toISOString(),
  },
  {
    id: "target-2",
    month_ref: `${localDateOffset(0).slice(0, 7)}-01`,
    title: "Limite de reinvestimento",
    type: "reinvestment_cap",
    amount: 1500,
    expected_date: null,
    applies_to_cashflow: false,
    offsets_monthly_bills: false,
    is_active: true,
    status: "pending",
    completed_at: null,
    recurrence_mode: "single",
    recurrence_weekdays: [],
    recurrence_occurrences: null,
    notes: "",
    created_at: new Date().toISOString(),
  },
];

describe("finance calculations", () => {
  it("calcula lucro liquido e roi do brick", () => {
    const metrics = calcBrickMetrics({
      ...bricks[0],
      actual_sale_date: localDateOffset(0),
      actual_sale_price: 1000,
      status: "sold",
    });

    expect(metrics.total_invested).toBe(750);
    expect(metrics.net_profit).toBe(250);
    expect(metrics.roi_percent).toBeCloseTo(33.33, 1);
  });

  it("traz a projeção diaria considerando contas, entradas e brick", () => {
    const projections = calcDailyProjections(settings.current_cash_balance, bills, incomes, bricks, settings, 5);

    expect(projections).toHaveLength(5);
    expect(projections[0].closing_balance).toBe(settings.current_cash_balance);
    expect(projections[1].expected_income).toBe(500);
    expect(projections[1].expected_expenses).toBe(900);
    expect(projections[2].expected_brick_income).toBe(1000);
  });

  it("resume o caixa e aponta necessidade de venda quando faltar folga", () => {
    const summary = calcCashSummary(300, bills, [], [], settings);

    expect(summary.total_pending_bills).toBe(900);
    expect(summary.sale_needed).toBeGreaterThan(0);
  });

  it("inclui meta mensal de side hustle na previsao e no abatimento das contas do mes", () => {
    const projections = calcDailyProjections(300, bills, [], [], settings, 10, scenarios, "probable", undefined, monthlyTargets);
    const summary = calcCashSummary(300, bills, [], [], settings, scenarios, "probable", undefined, monthlyTargets);

    expect(projections.some((day) => day.expected_income === 900)).toBe(true);
    expect(summary.monthly_planning.goal_income_total).toBe(900);
    expect(summary.monthly_planning.net_bills_after_goals).toBe(0);
  });

  it("separa a projecao real da projecao otimista com metas", () => {
    const projectedWithGoals = calcDailyProjections(300, bills, [], [], settings, 10, scenarios, "probable", undefined, monthlyTargets);
    const realProjection = calcDailyProjections(300, bills, [], [], settings, 10, scenarios, "probable", undefined, []);

    expect(projectedWithGoals.some((day) => day.expected_income === 900)).toBe(true);
    expect(realProjection.some((day) => day.expected_income === 900)).toBe(false);
    expect(projectedWithGoals.at(-1)?.closing_balance).toBeGreaterThan(realProjection.at(-1)?.closing_balance ?? 0);
  });

  it("permite meta recorrente por dia da semana dentro do mes", () => {
    const recurringTarget: MonthlyTarget = {
      ...monthlyTargets[0],
      id: "target-weekly",
      amount: 200,
      recurrence_mode: "weekly",
      recurrence_weekdays: [1],
      recurrence_occurrences: 2,
      expected_date: null,
    };

    const projections = calcDailyProjections(300, [], [], [], settings, 40, scenarios, "probable", undefined, [recurringTarget]);
    const recurringDays = projections.filter((day) => day.expected_income === 200);
    const summary = calcCashSummary(300, [], [], [], settings, scenarios, "probable", undefined, [recurringTarget]);

    expect(recurringDays).toHaveLength(2);
    expect(summary.monthly_planning.goal_income_total).toBe(400);
  });

  it("materializa meta recorrente apenas nos proximos dias elegiveis do mes", () => {
    const targets = materializeMonthlyTargetDraft(
      {
        month_ref: "2026-04",
        title: "Meta recorrente",
        type: "side_hustle_goal",
        amount: 100,
        expected_date: "",
        applies_to_cashflow: true,
        offsets_monthly_bills: false,
        is_active: true,
        recurrence_mode: "weekly",
        recurrence_weekdays: [1, 2, 3],
        recurrence_occurrences: null,
        notes: "",
      },
      settings,
      new Date("2026-04-03T12:00:00"),
    );

    expect(targets.map((target) => target.expected_date)).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
    ]);
    expect(targets[0]?.title).toBe("Meta recorrente - 06/04 (Seg)");
    expect(targets[1]?.title).toBe("Meta recorrente - 07/04 (Ter)");
  });

  it("traz meta batida para o saldo real e deixa meta pendente so na leitura otimista", () => {
    const completedTarget: MonthlyTarget = {
      ...monthlyTargets[0],
      id: "target-completed",
      status: "completed",
      completed_at: localDateOffset(1),
      expected_date: localDateOffset(1),
      amount: 300,
    };
    const pendingTarget: MonthlyTarget = {
      ...monthlyTargets[0],
      id: "target-pending",
      status: "pending",
      completed_at: null,
      expected_date: localDateOffset(2),
      amount: 400,
    };

    const realProjection = calcDailyProjections(300, [], [], [], settings, 5, scenarios, "probable", undefined, [completedTarget]);
    const optimisticProjection = calcDailyProjections(300, [], [], [], settings, 5, scenarios, "probable", undefined, [completedTarget, pendingTarget]);

    expect(realProjection.some((day) => day.confirmed_income === 300)).toBe(true);
    expect(realProjection.some((day) => day.expected_income === 400)).toBe(false);
    expect(optimisticProjection.some((day) => day.expected_income === 400)).toBe(true);
  });

  it("limita o caixa livre aos compromissos dentro da janela projetada", () => {
    const distantBill: Bill = {
      ...bills[0],
      id: "bill-future",
      due_date: localDateOffset(40),
      amount: 1200,
    };

    const projections30 = calcDailyProjections(1000, [distantBill], [], [], settings, 30);
    const projections45 = calcDailyProjections(1000, [distantBill], [], [], settings, 45);

    expect(projections30[0].free_cash_after_commitments).toBe(1000);
    expect(projections45[0].free_cash_after_commitments).toBe(-200);
  });

  it("permite proteger capital e lucro de brick da leitura de contas", () => {
    const protectedBrick: BrickItem = {
      ...bricks[0],
      reserve_invested_capital: true,
      reserve_profit_for_reinvestment: true,
      actual_sale_date: localDateOffset(1),
      actual_sale_price: 1200,
      status: "sold",
    };

    const projections = calcDailyProjections(500, [], [], [protectedBrick], settings, 5);

    expect(projections[1].confirmed_brick_income).toBe(0);
  });

  it("mantem a reserva de brick mesmo quando a compra nao desconta do caixa operacional", () => {
    const protectedSale: BrickItem = {
      ...bricks[0],
      id: "brick-protected-sale",
      reserve_invested_capital: true,
      reserve_profit_for_reinvestment: true,
      actual_sale_date: localDateOffset(1),
      actual_sale_price: 1200,
      status: "sold",
    };
    const repurchasedBrick: BrickItem = {
      ...bricks[0],
      id: "brick-repurchase",
      purchase_affects_cash_flow: false,
      purchase_date: localDateOffset(2),
      purchase_price: 400,
      target_sale_price: 620,
      minimum_sale_price: 450,
      probable_sale_price: 560,
      actual_sale_date: null,
      actual_sale_price: null,
      status: "purchased",
      reserve_invested_capital: false,
      reserve_profit_for_reinvestment: false,
      costs: [],
    };

    const reserveProjection = calcBrickReserveProjection(
      [protectedSale, repurchasedBrick],
      settings,
      5,
      scenarios,
      "probable",
    );

    expect(reserveProjection[1].reserved_cash).toBe(1200);
    expect(reserveProjection[2].reserved_cash).toBe(1200);
  });

  it("marca conta pendente vencida como overdue no comportamento efetivo", () => {
    const overdueBill: Bill = {
      ...bills[0],
      due_date: localDateOffset(-1),
    };

    expect(normalizeBillStatus(overdueBill)).toBe("overdue");
  });

  it("ranqueia bricks para venda com cobertura prevista", () => {
    const projections = calcDailyProjections(300, bills, incomes, bricks, settings, 10, scenarios, "probable");
    const recommendations = suggestSales(bricks, 600, projections, settings, scenarios, "probable");

    expect(recommendations[0]?.brick.id).toBe("brick-1");
    expect(recommendations[0]?.estimated_sale_price).toBeGreaterThan(0);
  });

  it("simula venda e atraso de entrada na timeline", () => {
    const result = buildSimulationResult(300, bills, incomes, bricks, settings, scenarios, {
      selected_scenario: "probable",
      selected_brick_ids: ["brick-1"],
      delay_income_id: "income-1",
      delay_income_days: 3,
      extra_investment_amount: 0,
      extra_investment_date: null,
      extra_investment_return_amount: 0,
      shift_bill_id: null,
      shift_bill_days: 0,
    }, 30, monthlyTargets);

    expect(result.projections).toHaveLength(30);
    expect(result.notes.join(" ")).toContain("Venda simulada");
    expect(result.sale_recommendations.some((recommendation) => recommendation.brick.id === "brick-1")).toBe(false);
  });

  it("gera alertas para conta vencida e caixa em risco", () => {
    const overdueBill: Bill = {
      ...bills[0],
      due_date: localDateOffset(-2),
      status: "pending",
    };

    const projections = calcDailyProjections(100, [overdueBill], [], [], settings, 7);
    const alerts = generateAlerts([overdueBill], [], projections, settings);

    expect(alerts.some((alert) => alert.type === "bill_overdue")).toBe(true);
    expect(alerts.some((alert) => alert.type === "cash_below_reserve" || alert.type === "cash_negative")).toBe(true);
  });

  it("monta snapshot de relatorio com fluxo e giro", () => {
    const report = buildReportSnapshot(1200, bills, incomes, bricks, categories, settings, scenarios, "probable", 3, monthlyTargets);

    expect(report.monthly_flow).toHaveLength(3);
    expect(report.income_planned_vs_actual).toHaveLength(3);
    expect(report.turnover_ratio).toBeGreaterThanOrEqual(0);
    expect(report.monthly_flow.at(-1)?.goal_income).toBeGreaterThanOrEqual(900);
  });
});
