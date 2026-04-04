import { addDays, differenceInDays, endOfMonth, format, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";

import type {
  Alert,
  Bill,
  BillStatus,
  BrickReserveProjection,
  BrickItem,
  BrickMetrics,
  CashSummary,
  Category,
  DailyProjection,
  Income,
  MonthlyPlanningMetrics,
  MonthlyTarget,
  ReportSnapshot,
  SaleRecommendation,
  ScenarioConfig,
  ScenarioType,
  Settings,
  SimulationConfig,
  SimulationResult,
} from "@/types/finance";

const ACTIVE_BRICK_STATUSES = ["planned", "purchased", "listed", "reserved"] as const;
const ACTIVE_SALE_BRICK_STATUSES = ["purchased", "listed", "reserved"] as const;
const FUTURE_INCOME_STATUSES = ["expected", "confirmed"] as const;
const UPCOMING_BILL_STATUSES = ["pending", "overdue"] as const;

function isoToday(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function safeParse(dateValue: string | null | undefined, fallback: Date) {
  if (!dateValue) {
    return fallback;
  }

  return parseISO(dateValue);
}

function addDaysIso(dateValue: string, days: number) {
  return format(addDays(parseISO(dateValue), days), "yyyy-MM-dd");
}

function riskScoreValue(risk: BrickItem["risk_level"]) {
  return risk === "low" ? 92 : risk === "medium" ? 64 : 32;
}

export function normalizeBillStatus(bill: Bill, today = isoToday()): BillStatus {
  if (bill.status === "pending" && bill.due_date < today) {
    return "overdue";
  }

  return bill.status;
}

export function calcBrickMetrics(brick: BrickItem, referenceDate = new Date()): BrickMetrics {
  const totalCosts = brick.costs.reduce((sum, cost) => sum + cost.amount, 0);
  const totalInvested = brick.purchase_price + totalCosts;
  const salePrice = brick.actual_sale_price ?? brick.probable_sale_price ?? brick.target_sale_price ?? brick.purchase_price;
  const grossProfit = salePrice - brick.purchase_price;
  const netProfit = salePrice - totalInvested;
  const roiPercent = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  const marginPercent = salePrice > 0 ? (netProfit / salePrice) * 100 : 0;
  const endDate = brick.actual_sale_date ? parseISO(brick.actual_sale_date) : referenceDate;
  const daysLocked = Math.max(1, differenceInDays(endDate, parseISO(brick.purchase_date)));
  const profitPerDay = netProfit / daysLocked;

  return {
    total_invested: roundCurrency(totalInvested),
    gross_profit: roundCurrency(grossProfit),
    net_profit: roundCurrency(netProfit),
    roi_percent: roundCurrency(roiPercent),
    days_locked: daysLocked,
    profit_per_day: roundCurrency(profitPerDay),
    margin_percent: roundCurrency(marginPercent),
  };
}

export function calcTotalInvested(brick: BrickItem): number {
  return roundCurrency(brick.purchase_price + brick.costs.reduce((sum, cost) => sum + cost.amount, 0));
}

export function calcLockedCapital(bricks: BrickItem[]): number {
  return roundCurrency(
    bricks
      .filter((brick) => ACTIVE_BRICK_STATUSES.includes(brick.status))
      .reduce((sum, brick) => sum + calcTotalInvested(brick), 0),
  );
}

export function calcPlannedBrickInvestment(bricks: BrickItem[]): number {
  return roundCurrency(
    bricks
      .filter((brick) => brick.status === "planned" && brickPurchaseAffectsCashFlow(brick))
      .reduce((sum, brick) => sum + calcTotalInvested(brick), 0),
  );
}

export function calcExpectedBrickReturns(bricks: BrickItem[]): number {
  return roundCurrency(
    bricks
      .filter((brick) => ACTIVE_BRICK_STATUSES.includes(brick.status) || brick.status === "sold")
      .reduce(
        (sum, brick) =>
          sum +
          getProtectedBrickSaleAmounts(brick, brick.actual_sale_price ?? brick.probable_sale_price ?? 0).available_cash,
        0,
      ),
  );
}

export function calculateLiquidityScore(brick: BrickItem) {
  const base = brick.liquidity === "high" ? 82 : brick.liquidity === "medium" ? 58 : 34;
  const statusBoost = brick.status === "reserved" ? 12 : brick.status === "listed" ? 8 : brick.status === "purchased" ? 3 : -10;
  const ageDays = Math.max(0, differenceInDays(new Date(), parseISO(brick.purchase_date)));
  const agePenalty = ageDays > 120 ? 12 : ageDays > 60 ? 6 : 0;
  const riskPenalty = brick.risk_level === "high" ? 15 : brick.risk_level === "medium" ? 7 : 0;

  return clamp(base + statusBoost - agePenalty - riskPenalty, 5, 100);
}

export function evaluateBrickRating(brick: BrickItem) {
  const metrics = calcBrickMetrics(brick);

  if (metrics.net_profit >= 0 && metrics.roi_percent >= 25 && metrics.profit_per_day > 0) {
    return "excellent";
  }

  if (metrics.net_profit >= 0 && metrics.roi_percent >= 8) {
    return "good";
  }

  return "bad";
}

function getScenarioConfig(
  settings: Settings,
  scenarios: ScenarioConfig[],
  scenarioName?: ScenarioType,
) {
  return (
    scenarios.find((scenario) => scenario.name === (scenarioName ?? settings.default_scenario)) ??
    scenarios.find((scenario) => scenario.name === settings.default_scenario) ?? {
      id: "fallback",
      name: settings.default_scenario,
      sale_price_multiplier: 1,
      sale_delay_days: 0,
      expected_income_multiplier: 1,
    }
  );
}

function normalizeMonthRef(value: string) {
  return format(startOfMonth(parseISO(value)), "yyyy-MM-dd");
}

function monthKey(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "yyyy-MM");
}

function resolveMonthlyTargetExpectedDate(target: MonthlyTarget, settings: Settings) {
  if (target.expected_date) {
    return target.expected_date;
  }

  const monthStart = startOfMonth(parseISO(target.month_ref));
  const safeDay = clamp(settings.default_goal_day, 1, 28);
  return format(addDays(monthStart, safeDay - 1), "yyyy-MM-dd");
}

function isIncomeGoal(target: MonthlyTarget) {
  return target.type === "side_hustle_goal" || target.type === "extra_income_goal";
}

function expandMonthlyTargetDates(target: MonthlyTarget, settings: Settings) {
  if (target.recurrence_mode !== "weekly" || target.recurrence_weekdays.length === 0) {
    return [resolveMonthlyTargetExpectedDate(target, settings)];
  }

  const monthStart = startOfMonth(parseISO(target.month_ref));
  const monthEnd = endOfMonth(monthStart);
  const dates: string[] = [];

  for (let cursor = monthStart; cursor <= monthEnd; cursor = addDays(cursor, 1)) {
    if (target.recurrence_weekdays.includes(cursor.getDay())) {
      dates.push(format(cursor, "yyyy-MM-dd"));
    }
  }

  if (target.recurrence_occurrences && target.recurrence_occurrences > 0) {
    return dates.slice(0, target.recurrence_occurrences);
  }

  return dates.length > 0 ? dates : [resolveMonthlyTargetExpectedDate(target, settings)];
}

export function getMonthlyTargetTotal(target: MonthlyTarget, settings: Settings) {
  if (target.recurrence_mode === "weekly" && target.recurrence_weekdays.length > 0) {
    return roundCurrency(target.amount * expandMonthlyTargetDates(target, settings).length);
  }

  return roundCurrency(target.amount);
}

function brickPurchaseAffectsCashFlow(brick: BrickItem) {
  return brick.purchase_affects_cash_flow !== false;
}

function getProtectedBrickSaleAmounts(brick: BrickItem, saleValue: number) {
  const totalInvested = calcTotalInvested(brick);
  const protectedCapital = brick.reserve_invested_capital ? Math.min(totalInvested, saleValue) : 0;
  const availableAfterCapital = Math.max(0, saleValue - protectedCapital);
  const protectedProfit = brick.reserve_profit_for_reinvestment
    ? Math.min(Math.max(0, saleValue - totalInvested), availableAfterCapital)
    : 0;
  const availableCash = Math.max(0, saleValue - protectedCapital - protectedProfit);

  return {
    protected_capital: roundCurrency(protectedCapital),
    protected_profit: roundCurrency(protectedProfit),
    available_cash: roundCurrency(availableCash),
  };
}

function buildSyntheticGoalIncomes(monthlyTargets: MonthlyTarget[], settings: Settings): Income[] {
  return monthlyTargets
    .filter((target) => target.is_active && isIncomeGoal(target))
    .flatMap((target) =>
      (target.status === "completed"
        ? [target.completed_at ?? resolveMonthlyTargetExpectedDate(target, settings)]
        : expandMonthlyTargetDates(target, settings))
        .map((expectedDate, index) => {
          const status =
            target.status === "completed"
              ? "received"
              : settings.goals_affect_cashflow && target.applies_to_cashflow
                ? "expected"
                : null;

          if (!status) {
            return null;
          }

          return {
            id: `goal-${target.id}-${index}`,
            type: target.type === "side_hustle_goal" ? "side_hustle" : "extra",
            category_id: null,
            description: target.title,
            amount: roundCurrency(target.amount),
            expected_date: expectedDate,
            received_date: status === "received" ? target.completed_at ?? expectedDate : null,
            status,
            source: "Meta mensal",
            notes:
              target.notes ||
              (target.recurrence_mode === "weekly"
                ? "Entrada prevista por meta recorrente."
                : "Entrada prevista a partir de meta mensal."),
            created_at: target.created_at,
            updated_at: target.updated_at,
          } satisfies Income;
        })
        .filter((income): income is Income => income !== null),
    );
}

function getMonthlyTargetsForMonth(monthlyTargets: MonthlyTarget[], monthStart: Date) {
  const key = monthKey(monthStart);
  return monthlyTargets.filter((target) => target.is_active && monthKey(normalizeMonthRef(target.month_ref)) === key);
}

function buildMonthlyPlanningMetrics(
  monthStart: Date,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  monthlyTargets: MonthlyTarget[],
  settings: Settings,
  projections: DailyProjection[] = [],
  fallbackBalance = settings.current_cash_balance,
): MonthlyPlanningMetrics {
  const monthEnd = endOfMonth(monthStart);
  const monthTargets = getMonthlyTargetsForMonth(monthlyTargets, monthStart);
  const monthBillsTotal = bills
    .filter((bill) => {
      const status = normalizeBillStatus(bill);
      return status !== "cancelled" && safeParse(bill.due_date, monthStart) >= monthStart && safeParse(bill.due_date, monthStart) <= monthEnd;
    })
    .reduce((sum, bill) => sum + bill.amount, 0);
  const forecastIncomeTotal = incomes
    .filter((income) => income.status !== "cancelled" && safeParse(income.expected_date, monthStart) >= monthStart && safeParse(income.expected_date, monthStart) <= monthEnd)
    .reduce((sum, income) => sum + income.amount, 0);
  const goalIncomeTotal = monthTargets
    .filter((target) => isIncomeGoal(target))
    .reduce((sum, target) => sum + getMonthlyTargetTotal(target, settings), 0);
  const billOffsetTotal = settings.goals_reduce_month_bills
    ? monthTargets
        .filter((target) => isIncomeGoal(target) && target.offsets_monthly_bills)
        .reduce((sum, target) => sum + getMonthlyTargetTotal(target, settings), 0)
    : 0;
  const expenseCap = monthTargets
    .filter((target) => target.type === "expense_cap")
    .reduce((sum, target) => sum + getMonthlyTargetTotal(target, settings), 0);
  const plannedReinvestmentTotal = bricks
    .filter(
      (brick) =>
        brick.status !== "cancelled" &&
        safeParse(brick.purchase_date, monthStart) >= monthStart &&
        safeParse(brick.purchase_date, monthStart) <= monthEnd,
    )
    .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);
  const reinvestmentCap = monthTargets
    .filter((target) => target.type === "reinvestment_cap")
    .reduce((sum, target) => sum + getMonthlyTargetTotal(target, settings), 0);
  const reserveGoal = monthTargets
    .filter((target) => target.type === "reserve_goal")
    .reduce((sum, target) => sum + getMonthlyTargetTotal(target, settings), 0);
  const monthEndProjection = projections
    .filter((projection) => monthKey(projection.date) === monthKey(monthStart))
    .at(-1)?.closing_balance ?? fallbackBalance;

  return {
    month_label: format(monthStart, "MM/yy"),
    month_ref: normalizeMonthRef(format(monthStart, "yyyy-MM-dd")),
    month_bills_total: roundCurrency(monthBillsTotal),
    forecast_income_total: roundCurrency(forecastIncomeTotal),
    goal_income_total: roundCurrency(goalIncomeTotal),
    bill_offset_total: roundCurrency(billOffsetTotal),
    net_bills_after_goals: roundCurrency(Math.max(0, monthBillsTotal - billOffsetTotal)),
    expense_cap: roundCurrency(expenseCap),
    expense_cap_variance: expenseCap > 0 ? roundCurrency(monthBillsTotal - expenseCap) : 0,
    planned_reinvestment_total: roundCurrency(plannedReinvestmentTotal),
    reinvestment_cap: roundCurrency(reinvestmentCap),
    reinvestment_cap_variance: reinvestmentCap > 0 ? roundCurrency(plannedReinvestmentTotal - reinvestmentCap) : 0,
    reserve_goal: roundCurrency(reserveGoal),
    reserve_gap: reserveGoal > 0 ? roundCurrency(reserveGoal - monthEndProjection) : 0,
  };
}

function buildSyntheticInvestment(simulation: Partial<SimulationConfig>, settings: Settings): BrickItem | null {
  if (!simulation.extra_investment_amount || !simulation.extra_investment_date) {
    return null;
  }

  const expectedReturn = simulation.extra_investment_return_amount || simulation.extra_investment_amount * 1.18;

  return {
    id: "simulation-extra-investment",
    name: "Aporte simulado",
    category_id: null,
    purchase_price: simulation.extra_investment_amount,
    target_sale_price: roundCurrency(expectedReturn),
    minimum_sale_price: roundCurrency(simulation.extra_investment_amount),
    probable_sale_price: roundCurrency(expectedReturn),
    purchase_date: simulation.extra_investment_date,
    expected_sale_date: addDaysIso(simulation.extra_investment_date, 21),
    actual_sale_date: null,
    actual_sale_price: null,
    liquidity: "low",
    risk_level: "medium",
    status: "planned",
    purchase_channel: "Simulacao",
    sales_channel: "Simulacao",
    notes: `Aporte extra simulado com retorno esperado em ${settings.currency}.`,
    rating: null,
    created_at: simulation.extra_investment_date,
    updated_at: simulation.extra_investment_date,
    costs: [],
  };
}

function applyScenarioAndSimulation(
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  monthlyTargets: MonthlyTarget[],
  settings: Settings,
  scenarios: ScenarioConfig[],
  scenarioName?: ScenarioType,
  simulation?: Partial<SimulationConfig>,
) {
  const scenario = getScenarioConfig(settings, scenarios, scenarioName ?? simulation?.selected_scenario);
  const notes: string[] = [];
  const syntheticGoalIncomes = buildSyntheticGoalIncomes(monthlyTargets, settings);

  const adjustedBills = bills.map((bill) => {
    const nextBill = { ...bill };

    if (simulation?.shift_bill_id === bill.id && simulation.shift_bill_days) {
      nextBill.due_date = addDaysIso(bill.due_date, simulation.shift_bill_days);
      notes.push(`Conta ${bill.description} movida ${simulation.shift_bill_days} dia(s).`);
    }

    return nextBill;
  });

  const adjustedIncomes = [...incomes, ...syntheticGoalIncomes].map((income) => {
    const nextIncome = { ...income };

    if (FUTURE_INCOME_STATUSES.includes(income.status) && income.expected_date >= isoToday()) {
      nextIncome.amount = roundCurrency(income.amount * scenario.expected_income_multiplier);
    }

    if (simulation?.delay_income_id === income.id && simulation.delay_income_days) {
      nextIncome.expected_date = addDaysIso(income.expected_date, simulation.delay_income_days);
      notes.push(`Entrada ${income.description} atrasada em ${simulation.delay_income_days} dia(s).`);
    }

    return nextIncome;
  });

  const adjustedBricks = bricks.map((brick) => {
    const nextBrick: BrickItem = {
      ...brick,
      costs: brick.costs.map((cost) => ({ ...cost })),
    };

    if (ACTIVE_BRICK_STATUSES.includes(nextBrick.status)) {
      const probableBase = nextBrick.probable_sale_price || nextBrick.target_sale_price || nextBrick.purchase_price;
      nextBrick.probable_sale_price = roundCurrency(probableBase * scenario.sale_price_multiplier);

      if (nextBrick.expected_sale_date) {
        nextBrick.expected_sale_date = addDaysIso(nextBrick.expected_sale_date, scenario.sale_delay_days);
      }
    }

    if (simulation?.selected_brick_ids?.includes(brick.id) && !["sold", "cancelled", "loss"].includes(brick.status)) {
      const simulatedSalePrice = roundCurrency(
        Math.max(nextBrick.minimum_sale_price, nextBrick.probable_sale_price || nextBrick.purchase_price),
      );
      nextBrick.status = "sold";
      nextBrick.actual_sale_date = isoToday();
      nextBrick.actual_sale_price = simulatedSalePrice;
      notes.push(`Venda simulada de ${brick.name} por ${formatCurrency(simulatedSalePrice, settings.currency)}.`);
    }

    return nextBrick;
  });

  const syntheticInvestment = buildSyntheticInvestment(simulation ?? {}, settings);
  if (syntheticInvestment) {
    adjustedBricks.push(syntheticInvestment);
    notes.push(
      `Aporte simulado de ${formatCurrency(
        syntheticInvestment.purchase_price,
        settings.currency,
      )} em ${syntheticInvestment.purchase_date}.`,
    );
  }

  return { scenario, bills: adjustedBills, incomes: adjustedIncomes, bricks: adjustedBricks, notes };
}

function calculateRemainingCommitments(date: string, bills: Bill[], bricks: BrickItem[], windowEndDate?: string) {
  const futureBills = bills
    .filter(
      (bill) =>
        UPCOMING_BILL_STATUSES.includes(normalizeBillStatus(bill)) &&
        bill.due_date >= date &&
        (!windowEndDate || bill.due_date <= windowEndDate),
    )
    .reduce((sum, bill) => sum + bill.amount, 0);
  const futureInvestments = bricks
    .filter(
      (brick) =>
        brick.status === "planned" &&
        brickPurchaseAffectsCashFlow(brick) &&
        brick.purchase_date >= date &&
        (!windowEndDate || brick.purchase_date <= windowEndDate),
    )
    .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);

  return roundCurrency(futureBills + futureInvestments);
}

function buildProjectionNotes(params: {
  expectedIncome: number;
  confirmedIncome: number;
  expectedExpenses: number;
  confirmedExpenses: number;
  expectedBrickIncome: number;
  confirmedBrickIncome: number;
  plannedBrickInvestment: number;
  shortfall: number;
  belowReserve: boolean;
  negative: boolean;
  settings: Settings;
}) {
  const notes: string[] = [];
  const {
    expectedIncome,
    confirmedIncome,
    expectedExpenses,
    confirmedExpenses,
    expectedBrickIncome,
    confirmedBrickIncome,
    plannedBrickInvestment,
    shortfall,
    belowReserve,
    negative,
    settings,
  } = params;

  if (expectedIncome > 0) {
    notes.push(`Entradas previstas: ${formatCurrency(expectedIncome, settings.currency)}.`);
  }
  if (confirmedIncome > 0) {
    notes.push(`Entradas confirmadas: ${formatCurrency(confirmedIncome, settings.currency)}.`);
  }
  if (expectedExpenses > 0) {
    notes.push(`Saidas previstas: ${formatCurrency(expectedExpenses, settings.currency)}.`);
  }
  if (confirmedExpenses > 0) {
    notes.push(`Saidas confirmadas: ${formatCurrency(confirmedExpenses, settings.currency)}.`);
  }
  if (expectedBrickIncome > 0 || confirmedBrickIncome > 0) {
    notes.push(`Retorno de bricks: ${formatCurrency(expectedBrickIncome + confirmedBrickIncome, settings.currency)}.`);
  }
  if (plannedBrickInvestment > 0) {
    notes.push(`Aporte previsto em brick: ${formatCurrency(plannedBrickInvestment, settings.currency)}.`);
  }
  if (negative) {
    notes.push(`Caixa negativo. Faltam ${formatCurrency(shortfall, settings.currency)} para voltar acima da reserva.`);
  } else if (belowReserve) {
    notes.push(`Caixa abaixo da reserva. Faltam ${formatCurrency(shortfall, settings.currency)} de folga.`);
  }

  return notes;
}

interface ProjectionOptions {
  startDate?: string;
  startingBalance?: number;
}

export function calcDailyProjections(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  settings: Settings,
  days = 30,
  scenarios: ScenarioConfig[] = [],
  selectedScenario?: ScenarioType,
  simulation?: Partial<SimulationConfig>,
  monthlyTargets: MonthlyTarget[] = [],
  options: ProjectionOptions = {},
): DailyProjection[] {
  const adjusted = applyScenarioAndSimulation(
    bills,
    incomes,
    bricks,
    monthlyTargets,
    settings,
    scenarios,
    selectedScenario,
    simulation,
  );
  const actualToday = startOfDay(new Date());
  const projectionStart = options.startDate ? startOfDay(parseISO(options.startDate)) : actualToday;
  const projections: DailyProjection[] = [];
  let runningBalance = options.startingBalance ?? currentCash;
  const todayIso = isoToday(actualToday);
  const projectionEnd = format(addDays(projectionStart, Math.max(0, days - 1)), "yyyy-MM-dd");

  for (let index = 0; index < days; index += 1) {
    const date = addDays(projectionStart, index);
    const dateStr = format(date, "yyyy-MM-dd");
    const openingBalance = runningBalance;

    const pendingBills = adjusted.bills.filter((bill) => {
      const status = normalizeBillStatus(bill, todayIso);
      return bill.due_date === dateStr && status !== "paid" && status !== "cancelled";
    });
    const confirmedBills = adjusted.bills.filter((bill) => bill.paid_date === dateStr && bill.status === "paid");
    const expectedIncomeEntries = adjusted.incomes.filter(
      (income) => income.expected_date === dateStr && FUTURE_INCOME_STATUSES.includes(income.status),
    );
    const confirmedIncomeEntries = adjusted.incomes.filter(
      (income) => income.received_date === dateStr && income.status === "received",
    );
    const plannedBrickInvestment = adjusted.bricks
      .filter((brick) => brick.status === "planned" && brick.purchase_date === dateStr && brickPurchaseAffectsCashFlow(brick))
      .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);
    const expectedBrickIncome = adjusted.bricks
      .filter(
        (brick) =>
          ACTIVE_SALE_BRICK_STATUSES.includes(brick.status) &&
          brick.expected_sale_date === dateStr &&
          !brick.actual_sale_date,
      )
      .reduce((sum, brick) => sum + getProtectedBrickSaleAmounts(brick, brick.probable_sale_price || 0).available_cash, 0);
    const confirmedBrickIncome = adjusted.bricks
      .filter((brick) => brick.actual_sale_date === dateStr && brick.actual_sale_price !== null)
      .reduce((sum, brick) => sum + getProtectedBrickSaleAmounts(brick, brick.actual_sale_price ?? 0).available_cash, 0);

    const expectedExpenses = pendingBills.reduce((sum, bill) => sum + bill.amount, 0) + plannedBrickInvestment;
    const confirmedExpenses = confirmedBills.reduce((sum, bill) => sum + bill.amount, 0);
    const expectedIncome = expectedIncomeEntries.reduce((sum, income) => sum + income.amount, 0);
    const confirmedIncome = confirmedIncomeEntries.reduce((sum, income) => sum + income.amount, 0);
    const totalExpectedInflows = roundCurrency(expectedIncome + expectedBrickIncome);
    const totalConfirmedInflows = roundCurrency(confirmedIncome + confirmedBrickIncome);
    const totalExpectedOutflows = roundCurrency(expectedExpenses);
    const totalConfirmedOutflows = roundCurrency(confirmedExpenses);
    const closingBalance = roundCurrency(
      openingBalance + totalExpectedInflows + totalConfirmedInflows - totalExpectedOutflows - totalConfirmedOutflows,
    );
    const belowReserve = closingBalance < settings.minimum_cash_reserve;
    const negative = closingBalance < 0;
    const shortfall = negative
      ? roundCurrency(Math.abs(closingBalance) + settings.minimum_cash_reserve)
      : belowReserve
        ? roundCurrency(settings.minimum_cash_reserve - closingBalance)
        : 0;
    const committedCash = calculateRemainingCommitments(dateStr, adjusted.bills, adjusted.bricks, projectionEnd);
    const freeCashAfterCommitments = roundCurrency(closingBalance - committedCash);
    const riskLevel = negative ? "negative" : belowReserve || freeCashAfterCommitments < 0 ? "reserve" : "safe";

    projections.push({
      date: dateStr,
      opening_balance: roundCurrency(openingBalance),
      expected_income: roundCurrency(expectedIncome),
      confirmed_income: roundCurrency(confirmedIncome),
      expected_expenses: roundCurrency(expectedExpenses),
      confirmed_expenses: roundCurrency(confirmedExpenses),
      expected_brick_income: roundCurrency(expectedBrickIncome),
      confirmed_brick_income: roundCurrency(confirmedBrickIncome),
      planned_brick_investment: roundCurrency(plannedBrickInvestment),
      total_expected_inflows: totalExpectedInflows,
      total_confirmed_inflows: totalConfirmedInflows,
      total_expected_outflows: totalExpectedOutflows,
      total_confirmed_outflows: totalConfirmedOutflows,
      committed_cash: committedCash,
      free_cash_after_commitments: freeCashAfterCommitments,
      closing_balance: closingBalance,
      below_reserve: belowReserve,
      negative,
      needs_sale: negative || belowReserve,
      shortfall,
      risk_level: riskLevel,
      notes: buildProjectionNotes({
        expectedIncome,
        confirmedIncome,
        expectedExpenses,
        confirmedExpenses,
        expectedBrickIncome,
        confirmedBrickIncome,
        plannedBrickInvestment,
        shortfall,
        belowReserve,
        negative,
        settings,
      }),
    });

    runningBalance = closingBalance;
  }

  return projections;
}

export function calcBrickReserveProjection(
  bricks: BrickItem[],
  settings: Settings,
  days = 30,
  scenarios: ScenarioConfig[] = [],
  selectedScenario?: ScenarioType,
  simulation?: Partial<SimulationConfig>,
  monthlyTargets: MonthlyTarget[] = [],
  options: ProjectionOptions = {},
): BrickReserveProjection[] {
  const adjusted = applyScenarioAndSimulation(
    [],
    [],
    bricks,
    monthlyTargets,
    settings,
    scenarios,
    selectedScenario,
    simulation,
  );
  const actualToday = startOfDay(new Date());
  const todayIso = isoToday(actualToday);
  const projectionStart = options.startDate ? startOfDay(parseISO(options.startDate)) : actualToday;

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(projectionStart, index);
    const dateStr = format(date, "yyyy-MM-dd");
    const protectedFromConfirmedSales = adjusted.bricks
      .filter(
        (brick) =>
          brick.status === "sold" &&
          brick.actual_sale_date &&
          brick.actual_sale_price !== null &&
          brick.actual_sale_date <= dateStr,
      )
      .reduce((sum, brick) => {
        const protectedAmounts = getProtectedBrickSaleAmounts(brick, brick.actual_sale_price ?? 0);
        return sum + protectedAmounts.protected_capital + protectedAmounts.protected_profit;
      }, 0);

    const protectedFromProjectedSales =
      dateStr > todayIso
        ? adjusted.bricks
            .filter(
              (brick) =>
                ACTIVE_SALE_BRICK_STATUSES.includes(brick.status) &&
                !brick.actual_sale_date &&
                !!brick.expected_sale_date &&
                brick.expected_sale_date <= dateStr,
            )
            .reduce((sum, brick) => {
              const protectedAmounts = getProtectedBrickSaleAmounts(brick, brick.probable_sale_price || 0);
              return sum + protectedAmounts.protected_capital + protectedAmounts.protected_profit;
            }, 0)
        : 0;

    // "Nao desconta do caixa" apenas tira a compra do caixa operacional.
    // Sem um campo explicito dizendo que a compra consumiu reserva de brick,
    // nao baixamos a reserva protegida automaticamente.
    const reserveUsedInBricks = 0;

    const protectedSaleTotal = roundCurrency(protectedFromConfirmedSales + protectedFromProjectedSales);
    const reservedCash = roundCurrency(Math.max(0, protectedSaleTotal - reserveUsedInBricks));

    return {
      date: dateStr,
      reserved_cash: reservedCash,
      protected_sale_total: protectedSaleTotal,
      reserve_used_in_bricks: roundCurrency(reserveUsedInBricks),
    };
  });
}

export function calcCashSummary(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  settings: Settings,
  scenarios: ScenarioConfig[] = [],
  selectedScenario?: ScenarioType,
  simulation?: Partial<SimulationConfig>,
  monthlyTargets: MonthlyTarget[] = [],
): CashSummary {
  const adjusted = applyScenarioAndSimulation(
    bills,
    incomes,
    bricks,
    monthlyTargets,
    settings,
    scenarios,
    selectedScenario,
    simulation,
  );
  const projections = calcDailyProjections(
    currentCash,
    bills,
    incomes,
    bricks,
    settings,
    30,
    scenarios,
    selectedScenario,
    simulation,
    monthlyTargets,
  );
  const pendingBills = adjusted.bills.filter((bill) => {
    const status = normalizeBillStatus(bill);
    return status === "pending" || status === "overdue";
  });
  const expectedIncomes = adjusted.incomes.filter((income) => FUTURE_INCOME_STATUSES.includes(income.status));
  const soldThisMonth = adjusted.bricks.filter((brick) => {
    if (!brick.actual_sale_date || brick.status !== "sold") {
      return false;
    }

    const soldDate = parseISO(brick.actual_sale_date);
    const now = new Date();
    return soldDate.getMonth() === now.getMonth() && soldDate.getFullYear() === now.getFullYear();
  });

  const monthProfit = soldThisMonth.reduce((sum, brick) => sum + calcBrickMetrics(brick).net_profit, 0);
  const billsAtRisk = pendingBills.filter((bill) => {
    const projection = projections.find((item) => item.date === bill.due_date);
    return projection ? projection.shortfall > 0 : false;
  }).length;
  const firstSaleNeedDay = projections.find((projection) => projection.needs_sale);
  const negativeDay = projections.find((projection) => projection.negative);
  const projectedInflows30d = projections.reduce(
    (sum, projection) => sum + projection.total_expected_inflows + projection.total_confirmed_inflows,
    0,
  );
  const committedCash = roundCurrency(pendingBills.reduce((sum, bill) => sum + bill.amount, 0));
  const currentMonthPlanning = buildMonthlyPlanningMetrics(
    startOfMonth(new Date()),
    adjusted.bills,
    adjusted.incomes,
    adjusted.bricks,
    monthlyTargets,
    settings,
    projections,
    currentCash,
  );

  return {
    available_cash: roundCurrency(currentCash),
    committed_cash: committedCash,
    free_cash: roundCurrency(currentCash - committedCash),
    projected_cash_7d: projections[6]?.closing_balance ?? currentCash,
    projected_cash_15d: projections[14]?.closing_balance ?? currentCash,
    projected_cash_30d: projections[29]?.closing_balance ?? currentCash,
    projected_inflows_30d: roundCurrency(projectedInflows30d),
    total_pending_bills: committedCash,
    total_expected_income: roundCurrency(expectedIncomes.reduce((sum, income) => sum + income.amount, 0)),
    locked_in_bricks: calcLockedCapital(adjusted.bricks),
    planned_brick_investment: calcPlannedBrickInvestment(adjusted.bricks),
    expected_brick_returns: calcExpectedBrickReturns(adjusted.bricks),
    month_profit: roundCurrency(monthProfit),
    bills_at_risk: billsAtRisk,
    sale_needed: firstSaleNeedDay?.shortfall ?? 0,
    critical_due_date: firstSaleNeedDay?.date ?? null,
    day_goes_negative: negativeDay?.date ?? null,
    monthly_planning: currentMonthPlanning,
  };
}

function estimateSaleDate(brick: BrickItem, scenario: ScenarioConfig) {
  const today = isoToday();
  const fallback = brick.liquidity === "high" ? 2 : brick.liquidity === "medium" ? 5 : 9;
  const baseDate = brick.expected_sale_date ?? addDaysIso(today, fallback);
  const shifted = addDaysIso(baseDate, scenario.sale_delay_days);
  return shifted < today ? today : shifted;
}

function findCoverageUntil(
  projections: DailyProjection[],
  saleDate: string,
  saleValue: number,
  minimumReserve: number,
) {
  const firstIndex = projections.findIndex((projection) => projection.date >= saleDate);
  if (firstIndex < 0) {
    return null;
  }

  let lastCovered: string | null = null;
  for (let index = firstIndex; index < projections.length; index += 1) {
    const simulatedBalance = projections[index].closing_balance + saleValue;
    if (simulatedBalance < minimumReserve) {
      break;
    }
    lastCovered = projections[index].date;
  }

  return lastCovered;
}

export function suggestSales(
  bricks: BrickItem[],
  amountNeeded: number,
  projections: DailyProjection[] = [],
  settings?: Settings,
  scenarios: ScenarioConfig[] = [],
  scenarioName?: ScenarioType,
): SaleRecommendation[] {
  const scenario = settings
    ? getScenarioConfig(settings, scenarios, scenarioName)
    : {
        id: "fallback",
        name: scenarioName ?? "probable",
        sale_price_multiplier: 1,
        sale_delay_days: 0,
        expected_income_multiplier: 1,
      };
  const criticalDate = projections.find((projection) => projection.needs_sale)?.date ?? null;
  const maxInvested = Math.max(1, ...bricks.map((brick) => calcTotalInvested(brick)));

  return bricks
    .filter((brick) => ACTIVE_SALE_BRICK_STATUSES.includes(brick.status))
    .map((brick) => {
      const metrics = calcBrickMetrics(brick);
      const estimatedSalePrice = roundCurrency(
        Math.max(brick.minimum_sale_price, (brick.probable_sale_price || brick.purchase_price) * scenario.sale_price_multiplier),
      );
      const availableSaleCash = getProtectedBrickSaleAmounts(brick, estimatedSalePrice).available_cash;
      const estimatedSaleDate = estimateSaleDate(brick, scenario);
      const liquidityScore = calculateLiquidityScore(brick);
      const riskScore = riskScoreValue(brick.risk_level);
      const profitScore = clamp(50 + (metrics.net_profit / Math.max(1, metrics.total_invested)) * 100, 0, 100);
      const urgencyScore = criticalDate
        ? clamp(
            100 - Math.max(0, differenceInDays(parseISO(estimatedSaleDate), parseISO(criticalDate))) * 18,
            8,
            100,
          )
        : 45;
      const trappedCapitalScore = clamp((metrics.total_invested / maxInvested) * 100, 5, 100);
      const downsideRisk = roundCurrency(Math.max(0, brick.minimum_sale_price - estimatedSalePrice));
      const score = roundCurrency(
        liquidityScore * 0.28 + riskScore * 0.16 + profitScore * 0.2 + urgencyScore * 0.22 + trappedCapitalScore * 0.14 - downsideRisk / 20,
      );
      const reasons: string[] = [];

      if (liquidityScore >= 75) {
        reasons.push("Alta liquidez para gerar caixa rapido.");
      }
      if (riskScore >= 80) {
        reasons.push("Risco baixo de piora no ativo.");
      }
      if (metrics.net_profit > 0) {
        reasons.push(`Lucro liquido estimado de ${formatCurrency(metrics.net_profit, settings?.currency ?? "BRL")}.`);
      }
      if (criticalDate && estimatedSaleDate <= criticalDate) {
        reasons.push(`Consegue entrar antes do aperto previsto em ${criticalDate}.`);
      }
      if (trappedCapitalScore >= 70) {
        reasons.push("Libera uma fatia relevante do capital preso.");
      }
      if (brick.reserve_invested_capital || brick.reserve_profit_for_reinvestment) {
        reasons.push("Parte do retorno fica protegida para patrimonio ou recompra.");
      }
      if (amountNeeded > 0 && availableSaleCash >= amountNeeded) {
        reasons.push("Sozinho quase resolve a necessidade de caixa.");
      }

      return {
        brick,
        score,
        liquidity_score: roundCurrency(liquidityScore),
        risk_score: roundCurrency(riskScore),
        profit_score: roundCurrency(profitScore),
        urgency_score: roundCurrency(urgencyScore),
        trapped_capital_score: roundCurrency(trappedCapitalScore),
        downside_risk: downsideRisk,
        estimated_sale_price: availableSaleCash,
        estimated_sale_date: estimatedSaleDate,
        projected_relief: availableSaleCash,
        coverage_until: settings ? findCoverageUntil(projections, estimatedSaleDate, availableSaleCash, settings.minimum_cash_reserve) : null,
        reasons,
      } satisfies SaleRecommendation;
    })
    .sort((left, right) => right.score - left.score || right.projected_relief - left.projected_relief);
}

export function buildSimulationResult(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  settings: Settings,
  scenarios: ScenarioConfig[],
  simulation: Partial<SimulationConfig>,
  days = 30,
  monthlyTargets: MonthlyTarget[] = [],
): SimulationResult {
  const selectedScenario = simulation.selected_scenario ?? settings.default_scenario;
  const adjusted = applyScenarioAndSimulation(
    bills,
    incomes,
    bricks,
    monthlyTargets,
    settings,
    scenarios,
    selectedScenario,
    simulation,
  );
  const projections = calcDailyProjections(
    currentCash,
    bills,
    incomes,
    bricks,
    settings,
    days,
    scenarios,
    selectedScenario,
    simulation,
    monthlyTargets,
  );
  const summary = calcCashSummary(
    currentCash,
    bills,
    incomes,
    bricks,
    settings,
    scenarios,
    selectedScenario,
    simulation,
    monthlyTargets,
  );
  const recommendations = suggestSales(
    adjusted.bricks,
    summary.sale_needed,
    projections,
    settings,
    scenarios,
    selectedScenario,
  );
  const notes: string[] = [...adjusted.notes];

  if (!simulation.selected_brick_ids?.length) {
    notes.push("Sem venda simulada: o resultado mostra o efeito de nao vender nada.");
  }
  if (simulation.selected_brick_ids?.length) {
    notes.push(`Venda simulada de ${simulation.selected_brick_ids.length} brick(s).`);
  }
  if (simulation.delay_income_id && simulation.delay_income_days) {
    notes.push(`Uma entrada foi atrasada em ${simulation.delay_income_days} dia(s).`);
  }
  if (simulation.shift_bill_id && simulation.shift_bill_days) {
    notes.push(`Uma conta foi movida em ${simulation.shift_bill_days} dia(s).`);
  }
  if (simulation.extra_investment_amount && simulation.extra_investment_date) {
    notes.push(
      `Aporte extra de ${formatCurrency(simulation.extra_investment_amount, settings.currency)} em ${simulation.extra_investment_date}.`,
    );
  }

  return {
    projections,
    summary,
    sale_recommendations: recommendations,
    notes,
  };
}

export function generateAlerts(
  bills: Bill[],
  bricks: BrickItem[],
  projections: DailyProjection[],
  settings: Settings,
): Omit<Alert, "id" | "created_at" | "is_read">[] {
  if (!settings.alerts_enabled) {
    return [];
  }

  const alerts: Omit<Alert, "id" | "created_at" | "is_read">[] = [];
  const today = isoToday();
  const dueLimit = isoToday(addDays(new Date(), settings.bill_due_alert_days));

  bills
    .filter((bill) => normalizeBillStatus(bill, today) === "overdue")
    .forEach((bill) => {
      alerts.push({
        type: "bill_overdue",
        severity: "critical",
        title: `Conta vencida: ${bill.description}`,
        description: `${formatCurrency(bill.amount, settings.currency)} venceu em ${bill.due_date}.`,
        reference_type: "bill",
        reference_id: bill.id,
      });
    });

  bills
    .filter((bill) => {
      const status = normalizeBillStatus(bill, today);
      return status === "pending" && bill.due_date >= today && bill.due_date <= dueLimit;
    })
    .forEach((bill) => {
      alerts.push({
        type: "bill_due",
        severity: bill.priority === "critical" ? "critical" : "warning",
        title: `Conta vence em breve: ${bill.description}`,
        description: `${formatCurrency(bill.amount, settings.currency)} vence em ${bill.due_date}.`,
        reference_type: "bill",
        reference_id: bill.id,
      });
    });

  const negativeDay = projections.find((projection) => projection.negative);
  if (negativeDay) {
    alerts.push({
      type: "cash_negative",
      severity: "critical",
      title: "Caixa ficara negativo",
      description: `No dia ${negativeDay.date} o saldo vai para ${formatCurrency(negativeDay.closing_balance, settings.currency)}.`,
      reference_type: "projection",
      reference_id: null,
    });
  }

  const reserveDay = projections.find((projection) => projection.below_reserve && !projection.negative);
  if (reserveDay) {
    alerts.push({
      type: "cash_below_reserve",
      severity: "warning",
      title: "Caixa abaixo da reserva minima",
      description: `No dia ${reserveDay.date} sobram ${formatCurrency(reserveDay.closing_balance, settings.currency)}.`,
      reference_type: "projection",
      reference_id: null,
    });
  }

  bricks
    .filter((brick) => ACTIVE_SALE_BRICK_STATUSES.includes(brick.status))
    .forEach((brick) => {
      const daysLocked = differenceInDays(new Date(), parseISO(brick.purchase_date));
      if (daysLocked > settings.stale_brick_days) {
        alerts.push({
          type: "brick_stale",
          severity: daysLocked > settings.stale_brick_days * 1.5 ? "warning" : "info",
          title: `Brick parado: ${brick.name}`,
          description: `${daysLocked} dias desde a compra sem venda confirmada.`,
          reference_type: "brick",
          reference_id: brick.id,
        });
      }
    });

  bricks
    .filter(
      (brick) => brick.status === "sold" && brick.actual_sale_price !== null && brick.actual_sale_price < brick.minimum_sale_price,
    )
    .forEach((brick) => {
      alerts.push({
        type: "sale_below_min",
        severity: "warning",
        title: `Venda abaixo do minimo: ${brick.name}`,
        description: `Saiu por ${formatCurrency(brick.actual_sale_price ?? 0, settings.currency)} abaixo do minimo aceitavel.`,
        reference_type: "brick",
        reference_id: brick.id,
      });
    });

  const lockedCapital = calcLockedCapital(bricks);
  if (lockedCapital > settings.current_cash_balance * 1.5 && lockedCapital > 0) {
    alerts.push({
      type: "excess_locked",
      severity: "info",
      title: "Capital travado elevado",
      description: `Voce tem ${formatCurrency(lockedCapital, settings.currency)} preso em bricks ativos.`,
      reference_type: "summary",
      reference_id: null,
    });
  }

  const next7Days = projections.slice(0, 7);
  const expenseWindow = next7Days.reduce(
    (sum, item) => sum + item.total_expected_outflows + item.total_confirmed_outflows,
    0,
  );
  const incomeWindow = next7Days.reduce(
    (sum, item) => sum + item.total_expected_inflows + item.total_confirmed_inflows,
    0,
  );
  if (expenseWindow > incomeWindow) {
    alerts.push({
      type: "bills_before_income",
      severity: "warning",
      title: "Muitas contas antes dos recebimentos",
      description: `Nos proximos 7 dias saem ${formatCurrency(expenseWindow, settings.currency)} e entram ${formatCurrency(incomeWindow, settings.currency)}.`,
      reference_type: "summary",
      reference_id: null,
    });
  }

  return alerts;
}

export function buildReportSnapshot(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  categories: Category[],
  settings: Settings,
  scenarios: ScenarioConfig[] = [],
  selectedScenario?: ScenarioType,
  months = 6,
  monthlyTargets: MonthlyTarget[] = [],
): ReportSnapshot {
  const today = new Date();
  const monthAnchors = Array.from({ length: months }, (_, index) => startOfMonth(subMonths(today, months - 1 - index)));
  const adjusted = applyScenarioAndSimulation(bills, incomes, bricks, monthlyTargets, settings, scenarios, selectedScenario);
  const projections = calcDailyProjections(
    currentCash,
    bills,
    incomes,
    bricks,
    settings,
    30,
    scenarios,
    selectedScenario,
    undefined,
    monthlyTargets,
  );

  const monthlyFlow = monthAnchors.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const label = format(monthStart, "MM/yy");
    const expectedIncome = adjusted.incomes
      .filter((income) => income.expected_date && safeParse(income.expected_date, monthStart) >= monthStart && safeParse(income.expected_date, monthStart) <= monthEnd && income.status !== "cancelled")
      .reduce((sum, income) => sum + income.amount, 0);
    const confirmedIncome = adjusted.incomes
      .filter((income) => income.received_date && safeParse(income.received_date, monthStart) >= monthStart && safeParse(income.received_date, monthStart) <= monthEnd)
      .reduce((sum, income) => sum + income.amount, 0);
    const expectedExpenses = adjusted.bills
      .filter((bill) => safeParse(bill.due_date, monthStart) >= monthStart && safeParse(bill.due_date, monthStart) <= monthEnd && bill.status !== "cancelled")
      .reduce((sum, bill) => sum + bill.amount, 0);
    const confirmedExpenses = adjusted.bills
      .filter((bill) => bill.paid_date && safeParse(bill.paid_date, monthStart) >= monthStart && safeParse(bill.paid_date, monthStart) <= monthEnd)
      .reduce((sum, bill) => sum + bill.amount, 0);
    const projectedBrickReturns = adjusted.bricks
      .filter(
        (brick) =>
          brick.expected_sale_date &&
          safeParse(brick.expected_sale_date, monthStart) >= monthStart &&
          safeParse(brick.expected_sale_date, monthStart) <= monthEnd,
      )
      .reduce((sum, brick) => sum + (brick.probable_sale_price || 0), 0);
    const confirmedBrickReturns = adjusted.bricks
      .filter(
        (brick) =>
          brick.actual_sale_date &&
          safeParse(brick.actual_sale_date, monthStart) >= monthStart &&
          safeParse(brick.actual_sale_date, monthStart) <= monthEnd,
      )
      .reduce((sum, brick) => sum + (brick.actual_sale_price ?? 0), 0);
    const brickProfitReal = adjusted.bricks
      .filter(
        (brick) =>
          brick.status === "sold" &&
          brick.actual_sale_date &&
          safeParse(brick.actual_sale_date, monthStart) >= monthStart &&
          safeParse(brick.actual_sale_date, monthStart) <= monthEnd,
      )
      .reduce((sum, brick) => sum + calcBrickMetrics(brick).net_profit, 0);
    const lockedCapital = adjusted.bricks
      .filter((brick) => parseISO(brick.purchase_date) <= monthEnd && (!brick.actual_sale_date || parseISO(brick.actual_sale_date) > monthEnd))
      .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);
    const planning = buildMonthlyPlanningMetrics(
      monthStart,
      adjusted.bills,
      adjusted.incomes,
      adjusted.bricks,
      monthlyTargets,
      settings,
      projections,
      currentCash,
    );

    return {
      month: label,
      expected_income: roundCurrency(expectedIncome),
      confirmed_income: roundCurrency(confirmedIncome),
      expected_expenses: roundCurrency(expectedExpenses),
      confirmed_expenses: roundCurrency(confirmedExpenses),
      goal_income: planning.goal_income_total,
      net_expenses_after_goals: planning.net_bills_after_goals,
      expense_cap: planning.expense_cap,
      reinvestment_cap: planning.reinvestment_cap,
      reserve_goal: planning.reserve_goal,
      projected_brick_returns: roundCurrency(projectedBrickReturns),
      confirmed_brick_returns: roundCurrency(confirmedBrickReturns),
      brick_profit_real: roundCurrency(brickProfitReal),
      locked_capital: roundCurrency(lockedCapital),
      free_cash_projection: roundCurrency(confirmedIncome + confirmedBrickReturns - confirmedExpenses),
    };
  });

  const incomePlannedVsActual = monthAnchors.map((monthStart) => {
    const label = format(monthStart, "MM/yy");
    const planned = adjusted.incomes
      .filter((income) => format(parseISO(income.expected_date), "MM/yy") === label && income.status !== "cancelled")
      .reduce((sum, income) => sum + income.amount, 0);
    const actual = adjusted.incomes
      .filter((income) => income.received_date && format(parseISO(income.received_date), "MM/yy") === label)
      .reduce((sum, income) => sum + income.amount, 0);

    return {
      label,
      planned: roundCurrency(planned),
      actual: roundCurrency(actual),
      variance: roundCurrency(actual - planned),
    };
  });

  const salesPlannedVsActual = monthAnchors.map((monthStart) => {
    const label = format(monthStart, "MM/yy");
    const planned = adjusted.bricks
      .filter((brick) => brick.expected_sale_date && format(parseISO(brick.expected_sale_date), "MM/yy") === label)
      .reduce((sum, brick) => sum + (brick.probable_sale_price || 0), 0);
    const actual = adjusted.bricks
      .filter((brick) => brick.actual_sale_date && format(parseISO(brick.actual_sale_date), "MM/yy") === label)
      .reduce((sum, brick) => sum + (brick.actual_sale_price ?? 0), 0);

    return {
      label,
      planned: roundCurrency(planned),
      actual: roundCurrency(actual),
      variance: roundCurrency(actual - planned),
    };
  });

  const soldBricks = adjusted.bricks
    .filter((brick) => brick.status === "sold")
    .map((brick) => ({
      brick,
      metrics: calcBrickMetrics(brick),
      liquidity_score: calculateLiquidityScore(brick),
    }));

  const profitabilityByCategoryMap = new Map<string, number>();
  soldBricks.forEach(({ brick, metrics }) => {
    const categoryName = categories.find((category) => category.id === brick.category_id)?.name ?? "Sem categoria";
    profitabilityByCategoryMap.set(categoryName, (profitabilityByCategoryMap.get(categoryName) ?? 0) + metrics.net_profit);
  });

  const profitabilityByCategory = [...profitabilityByCategoryMap.entries()]
    .map(([name, value]) => ({ name, value: roundCurrency(value) }))
    .sort((left, right) => right.value - left.value);

  const averageLockedCapital =
    monthlyFlow.reduce((sum, item) => sum + item.locked_capital, 0) / Math.max(1, monthlyFlow.length);
  const turnoverRatio = roundCurrency(
    soldBricks.reduce((sum, row) => sum + (row.brick.actual_sale_price ?? 0), 0) / Math.max(1, averageLockedCapital),
  );

  return {
    monthly_flow: monthlyFlow,
    income_planned_vs_actual: incomePlannedVsActual,
    sales_planned_vs_actual: salesPlannedVsActual,
    top_profit_bricks: soldBricks.sort((left, right) => right.metrics.net_profit - left.metrics.net_profit).slice(0, 5),
    fastest_bricks: soldBricks.sort((left, right) => left.metrics.days_locked - right.metrics.days_locked).slice(0, 5),
    capital_evolution: monthlyFlow.map((item) => ({ month: item.month, value: item.locked_capital })),
    free_cash_evolution: projections
      .filter((_, index) => index % 5 === 0 || index === projections.length - 1)
      .map((projection) => ({ label: projection.date.slice(5), value: projection.closing_balance })),
    profitability_by_category: profitabilityByCategory,
    turnover_ratio: turnoverRatio,
    best_category: profitabilityByCategory[0]?.name ?? null,
  };
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
