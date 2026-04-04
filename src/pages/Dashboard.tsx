import { useEffect, useMemo, useState } from "react";
import { addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Box,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  RotateCcw,
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import StatePanel from "@/components/app/StatePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildSimulationResult,
  calcBrickReserveProjection,
  calcTotalInvested,
  calcCashSummary,
  calcDailyProjections,
  formatCurrency,
  generateAlerts,
  normalizeBillStatus,
  suggestSales,
} from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { AuditEvent, BrickItem, MonthlyTarget, SaleRecommendation, ScenarioType, SimulationConfig } from "@/types/finance";

type MonitoringMode = "next_30_days" | "current_month" | "months_span" | "until_date";

const scenarioLabels: Record<ScenarioType, string> = {
  conservative: "Conservador",
  probable: "Provavel",
  optimistic: "Otimista",
};

const activeIncomeStatuses = ["expected", "confirmed"] as const;

function MetricCard({
  title,
  value,
  description,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  tone?: "default" | "positive" | "warning" | "negative";
  icon: React.ElementType;
}) {
  const tones = {
    default: "text-foreground",
    positive: "text-positive",
    warning: "text-warning-custom",
    negative: "text-destructive",
  } as const;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
          <p className={`text-2xl font-semibold ${tones[tone]}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`rounded-2xl bg-muted p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function isIncomeGoal(target: MonthlyTarget) {
  return target.type === "side_hustle_goal" || target.type === "extra_income_goal";
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return null;
}

function getAvailableBrickSaleCash(brick: BrickItem, saleValue: number) {
  const totalInvested = calcTotalInvested(brick);
  const protectedCapital = brick.reserve_invested_capital ? Math.min(totalInvested, saleValue) : 0;
  const availableAfterCapital = Math.max(0, saleValue - protectedCapital);
  const protectedProfit = brick.reserve_profit_for_reinvestment
    ? Math.min(Math.max(0, saleValue - totalInvested), availableAfterCapital)
    : 0;

  return Math.max(0, saleValue - protectedCapital - protectedProfit);
}

function calculateDisplayedCurrentCash(
  currentCash: number,
  bills: ReturnType<typeof useFinanceStore>["bills"],
  incomes: ReturnType<typeof useFinanceStore>["incomes"],
  bricks: ReturnType<typeof useFinanceStore>["bricks"],
  auditEvents: AuditEvent[],
) {
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");
  const latestCashAdjustment = auditEvents.find((event) => {
    if (event.entity_type !== "settings" || event.action !== "update" || !event.payload) {
      return false;
    }

    return toOptionalNumber(event.payload.new_balance) !== null;
  });

  let anchorBalance = currentCash;
  let shouldApplyAllHistory = currentCash === 0;
  let movementStartDate: string | null = null;

  if (latestCashAdjustment?.payload) {
    anchorBalance = toOptionalNumber(latestCashAdjustment.payload.new_balance) ?? currentCash;
    movementStartDate = latestCashAdjustment.created_at.slice(0, 10);
    shouldApplyAllHistory = false;
  } else if (currentCash !== 0) {
    movementStartDate = today;
    shouldApplyAllHistory = false;
  }

  const isAfterAnchor = (date: string | null | undefined) => {
    if (!date || date > today) {
      return false;
    }
    if (shouldApplyAllHistory || !movementStartDate) {
      return true;
    }

    return date > movementStartDate;
  };

  const confirmedIncomeTotal = incomes
    .filter((income) => income.status === "received" && isAfterAnchor(income.received_date))
    .reduce((sum, income) => sum + income.amount, 0);
  const confirmedExpenseTotal = bills
    .filter((bill) => bill.status === "paid" && isAfterAnchor(bill.paid_date))
    .reduce((sum, bill) => sum + bill.amount, 0);
  const confirmedBrickSales = bricks
    .filter((brick) => brick.status === "sold" && brick.actual_sale_date && brick.actual_sale_price !== null && isAfterAnchor(brick.actual_sale_date))
    .reduce((sum, brick) => sum + getAvailableBrickSaleCash(brick, brick.actual_sale_price ?? 0), 0);
  const realizedBrickPurchases = bricks
    .filter((brick) => brick.status !== "planned" && brick.purchase_affects_cash_flow !== false && isAfterAnchor(brick.purchase_date))
    .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);

  return Math.round((anchorBalance + confirmedIncomeTotal + confirmedBrickSales - confirmedExpenseTotal - realizedBrickPurchases) * 100) / 100;
}

function calculateWindowOpeningBalance(
  currentBalance: number,
  startDate: string,
  bills: ReturnType<typeof useFinanceStore>["bills"],
  incomes: ReturnType<typeof useFinanceStore>["incomes"],
  bricks: ReturnType<typeof useFinanceStore>["bricks"],
  auditEvents: AuditEvent[],
) {
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");
  if (startDate >= today) {
    return currentBalance;
  }

  const confirmedIncomeTotal = incomes
    .filter((income) => income.status === "received" && income.received_date && income.received_date >= startDate && income.received_date <= today)
    .reduce((sum, income) => sum + income.amount, 0);
  const confirmedExpenseTotal = bills
    .filter((bill) => bill.status === "paid" && bill.paid_date && bill.paid_date >= startDate && bill.paid_date <= today)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const confirmedBrickSales = bricks
    .filter((brick) => brick.status === "sold" && brick.actual_sale_date && brick.actual_sale_price !== null && brick.actual_sale_date >= startDate && brick.actual_sale_date <= today)
    .reduce((sum, brick) => sum + getAvailableBrickSaleCash(brick, brick.actual_sale_price ?? 0), 0);
  const realizedBrickPurchases = bricks
    .filter((brick) => brick.status !== "planned" && brick.purchase_affects_cash_flow !== false && brick.purchase_date >= startDate && brick.purchase_date <= today)
    .reduce((sum, brick) => sum + calcTotalInvested(brick), 0);
  const cashAdjustmentsInRange = auditEvents
    .filter((event) => event.entity_type === "settings" && event.action === "update" && event.created_at.slice(0, 10) >= startDate && event.created_at.slice(0, 10) <= today)
    .reduce((sum, event) => sum + (toOptionalNumber(event.payload?.delta) ?? 0), 0);

  return Math.round((currentBalance - confirmedIncomeTotal - confirmedBrickSales + confirmedExpenseTotal + realizedBrickPurchases - cashAdjustmentsInRange) * 100) / 100;
}

export default function Dashboard() {
  const {
    currentCash,
    setCurrentCash,
    bills,
    incomes,
    bricks,
    settings,
    scenarios,
    monthlyTargets,
    auditEvents,
    completeMonthlyTarget,
    reopenMonthlyTarget,
    isSyncing,
  } = useFinanceStore();
  const [monitoringMode, setMonitoringMode] = useState<MonitoringMode>("next_30_days");
  const [monthsSpan, setMonthsSpan] = useState("2");
  const [untilDate, setUntilDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [simulation, setSimulation] = useState<SimulationConfig>({
    selected_scenario: settings.default_scenario,
    selected_brick_ids: [],
    delay_income_id: null,
    delay_income_days: 0,
    extra_investment_amount: 0,
    extra_investment_date: null,
    extra_investment_return_amount: 0,
    shift_bill_id: null,
    shift_bill_days: 0,
  });
  const [cashAdjustmentOpen, setCashAdjustmentOpen] = useState(false);
  const [cashAdjustment, setCashAdjustment] = useState({
    nextTotal: String(currentCash),
    note: "",
  });

  const displayedCurrentCash = useMemo(
    () => calculateDisplayedCurrentCash(currentCash, bills, incomes, bricks, auditEvents),
    [auditEvents, bills, bricks, currentCash, incomes],
  );

  useEffect(() => {
    setSimulation((current) => ({ ...current, selected_scenario: current.selected_scenario ?? settings.default_scenario }));
  }, [settings.default_scenario]);

  useEffect(() => {
    if (!cashAdjustmentOpen) {
      setCashAdjustment({ nextTotal: String(displayedCurrentCash), note: "" });
    }
  }, [cashAdjustmentOpen, displayedCurrentCash]);

  const monitoringWindow = useMemo(() => {
    const today = startOfDay(new Date());
    let startDate = new Date(today);
    let endDate = new Date(today);

    if (monitoringMode === "next_30_days") {
      endDate.setDate(endDate.getDate() + 29);
    } else if (monitoringMode === "current_month") {
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
    } else if (monitoringMode === "months_span") {
      startDate = startOfMonth(today);
      endDate = endOfMonth(addMonths(today, Math.max(1, Number(monthsSpan) || 1) - 1));
    } else if (untilDate) {
      const selectedDate = parseISO(untilDate);
      endDate = selectedDate < today ? today : selectedDate;
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      days: Math.max(1, differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate)) + 1),
      label:
        monitoringMode === "next_30_days"
          ? "Proximos 30 dias"
          : monitoringMode === "current_month"
            ? "Mes atual"
            : monitoringMode === "months_span"
              ? `${Math.max(1, Number(monthsSpan) || 1)} mes(es)`
              : `Ate ${format(endDate, "dd/MM")}`,
    };
  }, [monitoringMode, monthsSpan, untilDate]);

  const summary = useMemo(
    () =>
      calcCashSummary(
        displayedCurrentCash,
        bills,
        incomes,
        bricks,
        settings,
        scenarios,
        simulation.selected_scenario,
        undefined,
        monthlyTargets,
      ),
    [bills, bricks, displayedCurrentCash, incomes, monthlyTargets, scenarios, settings, simulation.selected_scenario],
  );

  const displayedFreeCash = useMemo(
    () => Math.round((displayedCurrentCash - summary.committed_cash) * 100) / 100,
    [displayedCurrentCash, summary.committed_cash],
  );

  const monitoringStartBalance = useMemo(
    () =>
      calculateWindowOpeningBalance(
        displayedCurrentCash,
        monitoringWindow.startDate,
        bills,
        incomes,
        bricks,
        auditEvents,
      ),
    [auditEvents, bills, bricks, displayedCurrentCash, incomes, monitoringWindow.startDate],
  );

  const completedMonthlyTargets = useMemo(
    () => monthlyTargets.filter((target) => target.is_active && target.status === "completed"),
    [monthlyTargets],
  );

  const monitoringRealProjections = useMemo(
    () =>
      calcDailyProjections(
        displayedCurrentCash,
        bills,
        incomes,
        bricks,
        settings,
        monitoringWindow.days,
        scenarios,
        simulation.selected_scenario,
        undefined,
        completedMonthlyTargets,
        {
          startDate: monitoringWindow.startDate,
          startingBalance: monitoringStartBalance,
        },
      ),
    [
      bills,
      bricks,
      displayedCurrentCash,
      incomes,
      monitoringStartBalance,
      monitoringWindow.days,
      monitoringWindow.startDate,
      completedMonthlyTargets,
      scenarios,
      settings,
      simulation.selected_scenario,
    ],
  );

  const monitoringProjectedWithGoals = useMemo(
    () =>
      calcDailyProjections(
        displayedCurrentCash,
        bills,
        incomes,
        bricks,
        settings,
        monitoringWindow.days,
        scenarios,
        simulation.selected_scenario,
        undefined,
        monthlyTargets,
        {
          startDate: monitoringWindow.startDate,
          startingBalance: monitoringStartBalance,
        },
      ),
    [
      bills,
      bricks,
      displayedCurrentCash,
      incomes,
      monitoringStartBalance,
      monitoringWindow.days,
      monitoringWindow.startDate,
      monthlyTargets,
      scenarios,
      settings,
      simulation.selected_scenario,
    ],
  );

  const simulationResult = useMemo(
    () =>
      buildSimulationResult(
        displayedCurrentCash,
        bills,
        incomes,
        bricks,
        settings,
        scenarios,
        simulation,
        monitoringWindow.days,
        [],
      ),
    [bills, bricks, displayedCurrentCash, incomes, monitoringWindow.days, scenarios, settings, simulation],
  );

  const monitoringAlerts = useMemo(
    () => generateAlerts(bills, bricks, monitoringRealProjections, settings),
    [bills, bricks, monitoringRealProjections, settings],
  );

  const recommendations = useMemo(
    () =>
      (simulationResult.sale_recommendations.length ? simulationResult.sale_recommendations : suggestSales(
        bricks,
        monitoringRealProjections.find((projection) => projection.needs_sale)?.shortfall ?? 0,
        monitoringRealProjections,
        settings,
        scenarios,
        simulation.selected_scenario,
      )).slice(0, 6),
    [bricks, monitoringRealProjections, scenarios, settings, simulation.selected_scenario, simulationResult.sale_recommendations],
  );

  const goalAmountByDate = useMemo(() => {
    const totals = new Map<string, number>();

    monthlyTargets
      .filter((target) => target.is_active && isIncomeGoal(target))
      .forEach((target) => {
        const schedule = (() => {
          if (target.recurrence_mode !== "weekly" || target.recurrence_weekdays.length === 0) {
            return [target.expected_date ?? `${target.month_ref.slice(0, 7)}-${String(settings.default_goal_day).padStart(2, "0")}`];
          }
          const monthStart = parseISO(target.month_ref);
          const monthEnd = endOfMonth(monthStart);
          const dates: string[] = [];
          for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setDate(cursor.getDate() + 1)) {
            if (target.recurrence_weekdays.includes(cursor.getDay())) {
              dates.push(format(cursor, "yyyy-MM-dd"));
            }
          }
          return target.recurrence_occurrences && target.recurrence_occurrences > 0
            ? dates.slice(0, target.recurrence_occurrences)
            : dates;
        })();

        schedule.forEach((date) => {
          totals.set(date, (totals.get(date) ?? 0) + target.amount);
        });
      });

    return totals;
  }, [monthlyTargets, settings.default_goal_day]);

  const brickReserveProjection = useMemo(
    () =>
      calcBrickReserveProjection(
        bricks,
        settings,
        monitoringWindow.days,
        scenarios,
        simulation.selected_scenario,
        simulation,
        monthlyTargets,
        {
          startDate: monitoringWindow.startDate,
        },
      ),
    [
      bricks,
      monitoringWindow.days,
      monitoringWindow.startDate,
      monthlyTargets,
      scenarios,
      settings,
      simulation,
    ],
  );

  const cumulativeBillsByDate = useMemo(() => {
    let runningBills = 0;
    const totals = new Map<string, number>();

    monitoringRealProjections.forEach((projection) => {
      runningBills += projection.expected_expenses + projection.confirmed_expenses - projection.planned_brick_investment;
      totals.set(projection.date, Math.round(runningBills * 100) / 100);
    });

    return totals;
  }, [monitoringRealProjections]);

  const chartData = useMemo(
    () =>
      monitoringRealProjections.map((projection, index) => ({
        label: format(parseISO(projection.date), "dd/MM"),
        saldoReal: projection.closing_balance,
        saldoMetas: monitoringProjectedWithGoals[index]?.closing_balance ?? projection.closing_balance,
        contasAcumuladas: (cumulativeBillsByDate.get(projection.date) ?? 0) * -1,
        paraBrick: brickReserveProjection.find((item) => item.date === projection.date)?.reserved_cash ?? 0,
        entradas: projection.total_expected_inflows + projection.total_confirmed_inflows,
        saidas: projection.total_expected_outflows + projection.total_confirmed_outflows,
        metas: goalAmountByDate.get(projection.date) ?? 0,
      })),
    [brickReserveProjection, cumulativeBillsByDate, goalAmountByDate, monitoringProjectedWithGoals, monitoringRealProjections],
  );

  const monitoringStats = useMemo(() => {
    const lastProjection = monitoringRealProjections.at(-1);
    const lastProjectionWithGoals = monitoringProjectedWithGoals.at(-1);
    const firstRisk = monitoringRealProjections.find((projection) => projection.needs_sale || projection.negative || projection.below_reserve);
    const todayIso = format(startOfDay(new Date()), "yyyy-MM-dd");
    const reserveToday =
      [...brickReserveProjection].reverse().find((item) => item.date <= todayIso) ??
      brickReserveProjection[0] ?? {
        reserved_cash: 0,
        protected_sale_total: 0,
        reserve_used_in_bricks: 0,
      };
    const reserveEnding = brickReserveProjection.at(-1) ?? reserveToday;
    const billTotal = bills
      .filter((bill) => {
        const status = normalizeBillStatus(bill);
        return (status === "pending" || status === "overdue") && bill.due_date >= monitoringWindow.startDate && bill.due_date <= monitoringWindow.endDate;
      })
      .reduce((sum, bill) => sum + bill.amount, 0);

    return {
      endingBalance: lastProjection?.closing_balance ?? displayedCurrentCash,
      endingBalanceWithGoals: lastProjectionWithGoals?.closing_balance ?? displayedCurrentCash,
      endingAccumulatedBills: cumulativeBillsByDate.get(lastProjection?.date ?? monitoringWindow.endDate) ?? 0,
      brickReserveToday: reserveToday.reserved_cash,
      brickReserveEnding: reserveEnding.reserved_cash,
      protectedSaleTotal: reserveToday.protected_sale_total,
      reserveUsedInBricks: reserveToday.reserve_used_in_bricks,
      billTotal,
      inflows: monitoringRealProjections.reduce((sum, item) => sum + item.total_expected_inflows + item.total_confirmed_inflows, 0),
      outflows: monitoringRealProjections.reduce((sum, item) => sum + item.total_expected_outflows + item.total_confirmed_outflows, 0),
      firstRisk,
    };
  }, [bills, brickReserveProjection, cumulativeBillsByDate, displayedCurrentCash, monitoringProjectedWithGoals, monitoringRealProjections, monitoringWindow.endDate, monitoringWindow.startDate]);

  const totalInAccount = useMemo(
    () => Math.round((displayedCurrentCash + monitoringStats.brickReserveToday) * 100) / 100,
    [displayedCurrentCash, monitoringStats.brickReserveToday],
  );

  const goalChecklist = useMemo(() => {
    return monthlyTargets
      .filter(
        (target) =>
          target.is_active &&
          isIncomeGoal(target) &&
          !!target.expected_date &&
          target.expected_date >= monitoringWindow.startDate &&
          target.expected_date <= monitoringWindow.endDate,
      )
      .sort((left, right) => {
        const dateCompare = (left.expected_date ?? "").localeCompare(right.expected_date ?? "");
        if (dateCompare !== 0) {
          return dateCompare;
        }

        return left.title.localeCompare(right.title);
      })
      .map((target) => {
        const totalTarget = target.amount;
        const actual = target.status === "completed" ? target.amount : 0;
        const projected =
          target.status === "pending" && settings.goals_affect_cashflow && target.applies_to_cashflow
            ? target.amount
            : 0;

        return {
          target,
          actual,
          projected,
          totalTarget,
          remainingReal: Math.max(0, totalTarget - actual),
          remainingProjected: Math.max(0, totalTarget - actual - projected),
          realProgress: Math.max(0, Math.min(100, (actual / Math.max(1, totalTarget)) * 100)),
          projectedProgress: Math.max(0, Math.min(100, ((actual + projected) / Math.max(1, totalTarget)) * 100)),
          status: target.status === "completed" ? "hit" : actual + projected >= totalTarget ? "projected" : "open",
        };
      });
  }, [monitoringWindow.endDate, monitoringWindow.startDate, monthlyTargets, settings]);

  const keyDays = useMemo(
    () =>
      monitoringRealProjections
        .filter((projection) => projection.notes.length > 0 || projection.needs_sale || projection.negative || projection.below_reserve)
        .slice(0, 5),
    [monitoringRealProjections],
  );

  const hasCashAdjustmentValue = cashAdjustment.nextTotal.trim() !== "" && Number.isFinite(Number(cashAdjustment.nextTotal));
  const cashAdjustmentValue = hasCashAdjustmentValue ? Number(cashAdjustment.nextTotal) : displayedCurrentCash;
  const cashAdjustmentDelta = Number((cashAdjustmentValue - displayedCurrentCash).toFixed(2));

  const isEmpty = bills.length === 0 && incomes.length === 0 && bricks.length === 0 && monthlyTargets.length === 0;

  function updateSimulation(patch: Partial<SimulationConfig>) {
    setSimulation((current) => ({ ...current, ...patch }));
  }

  function toggleBrick(recommendation: SaleRecommendation) {
    setSimulation((current) => ({
      ...current,
      selected_brick_ids: current.selected_brick_ids.includes(recommendation.brick.id)
        ? current.selected_brick_ids.filter((id) => id !== recommendation.brick.id)
        : [...current.selected_brick_ids, recommendation.brick.id],
    }));
  }

  function resetSimulation() {
    setSimulation({
      selected_scenario: settings.default_scenario,
      selected_brick_ids: [],
      delay_income_id: null,
      delay_income_days: 0,
      extra_investment_amount: 0,
      extra_investment_date: null,
      extra_investment_return_amount: 0,
      shift_bill_id: null,
      shift_bill_days: 0,
    });
  }

  async function handleCashCorrection() {
    if (!hasCashAdjustmentValue || !cashAdjustment.note.trim()) {
      return;
    }

    await setCurrentCash(cashAdjustmentValue, cashAdjustment.note.trim());
    setCashAdjustmentOpen(false);
    setCashAdjustment({ nextTotal: String(cashAdjustmentValue), note: "" });
  }

  if (isEmpty) {
    return <StatePanel title="Seu painel ainda esta vazio" description="Cadastre dados ou importe sua planilha para habilitar o monitoramento." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento diario do caixa com janela configuravel, simulacao pratica e metas de entrada mais claras.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Monitoramento do caixa</CardTitle>
                <p className="text-sm text-muted-foreground">
                  A leitura separa saldo real, saldo se metas baterem, caixa livre e valor reservado para brick.
                </p>
              </div>
              <Badge variant="outline">
                {monitoringWindow.label} - {monitoringWindow.days} dia(s)
              </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[200px_140px_180px]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Janela</p>
                <Select value={monitoringMode} onValueChange={(value) => setMonitoringMode(value as MonitoringMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next_30_days">Proximos 30 dias</SelectItem>
                    <SelectItem value="current_month">Mes atual</SelectItem>
                    <SelectItem value="months_span">Conjunto de meses</SelectItem>
                    <SelectItem value="until_date">Ate uma data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {monitoringMode === "months_span" && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Meses na leitura</p>
                  <Input type="number" min={1} max={12} value={monthsSpan} onChange={(event) => setMonthsSpan(event.target.value)} />
                </div>
              )}

              {monitoringMode === "until_date" && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Data final</p>
                  <Input type="date" value={untilDate} onChange={(event) => setUntilDate(event.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Cenario</p>
                <Select
                  value={simulation.selected_scenario}
                  onValueChange={(value) => updateSimulation({ selected_scenario: value as ScenarioType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(scenarioLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Dialog open={cashAdjustmentOpen} onOpenChange={setCashAdjustmentOpen}>
                <Button variant="outline" size="sm" onClick={() => setCashAdjustmentOpen(true)}>
                  Corrigir total em conta
                </Button>
                <DialogContent className="sm:max-w-[640px]">
                  <DialogHeader>
                    <DialogTitle>Corrigir total para contas</DialogTitle>
                    <DialogDescription>
                      Ajuste o caixa operacional. O total em conta consolidado continua sendo calculado somando esse valor com o que esta reservado para brick.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Novo total para contas</p>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={cashAdjustment.nextTotal}
                          onChange={(event) => setCashAdjustment((current) => ({ ...current, nextTotal: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">De onde voce acha que saiu ou entrou</p>
                        <Textarea
                          className="min-h-[110px]"
                          placeholder="Ex.: entrou PIX de cliente, paguei fornecedor fora do app, saquei dinheiro, teve taxa inesperada..."
                          value={cashAdjustment.note}
                          onChange={(event) => setCashAdjustment((current) => ({ ...current, note: event.target.value }))}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {hasCashAdjustmentValue
                        ? `Isso registra uma ${cashAdjustmentDelta >= 0 ? "entrada" : "saida"} de ${formatCurrency(Math.abs(cashAdjustmentDelta), settings.currency)} no caixa operacional.`
                        : "Informe o novo total para calcular a diferenca automaticamente."}
                    </p>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setCashAdjustmentOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void handleCashCorrection()} disabled={isSyncing || !hasCashAdjustmentValue || !cashAdjustment.note.trim()}>
                      Salvar correcao
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total em conta</p>
                <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalInAccount, settings.currency)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Leitura consolidada: total para contas somado ao valor que esta reservado para brick.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Para contas {formatCurrency(displayedCurrentCash, settings.currency)}</Badge>
                  <Badge variant="outline">Para brick {formatCurrency(monitoringStats.brickReserveToday, settings.currency)}</Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Valor para brick</p>
                <p className="mt-2 text-3xl font-semibold text-amber-400">{formatCurrency(monitoringStats.brickReserveToday, settings.currency)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dinheiro reservado de vendas protegidas para recompra ou aumento de patrimonio, fora do caixa das contas.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Protegido em vendas {formatCurrency(monitoringStats.protectedSaleTotal, settings.currency)}</Badge>
                  <Badge variant="outline">Reaplicado rastreado {formatCurrency(monitoringStats.reserveUsedInBricks, settings.currency)}</Badge>
                  <Badge variant="outline">Na janela {formatCurrency(monitoringStats.brickReserveEnding, settings.currency)}</Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total para contas</p>
                <p className="mt-2 text-3xl font-semibold">{formatCurrency(displayedCurrentCash, settings.currency)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Caixa operacional pensado para pagar contas, sem somar o dinheiro que esta separado para brick.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Reserva minima {formatCurrency(settings.minimum_cash_reserve, settings.currency)}</Badge>
                  <Badge variant="outline">Livre hoje {formatCurrency(displayedFreeCash, settings.currency)}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Saldo real na janela</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(monitoringStats.endingBalance, settings.currency)}</p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Se metas baterem</p>
                <p className="mt-2 text-xl font-semibold text-emerald-400">{formatCurrency(monitoringStats.endingBalanceWithGoals, settings.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  Linha projetada considerando metas de entrada ativas na janela.
                </p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Contas acumuladas</p>
                <p className={`mt-2 text-xl font-semibold ${monitoringStats.endingAccumulatedBills > 0 ? "text-primary" : "text-foreground"}`}>
                  {formatCurrency(monitoringStats.endingAccumulatedBills, settings.currency)}
                </p>
                <p className="text-xs text-muted-foreground">Soma das contas que ja passaram pela timeline ate o fim da leitura.</p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Valor para brick</p>
                <p className="mt-2 text-xl font-semibold text-amber-400">{formatCurrency(monitoringStats.brickReserveEnding, settings.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {monitoringStats.brickReserveEnding > 0
                    ? `Ja houve ${formatCurrency(monitoringStats.protectedSaleTotal, settings.currency)} protegido em vendas.`
                    : "Sem reserva separada para brick nessa leitura."}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Contas no periodo</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(monitoringStats.billTotal, settings.currency)}</p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Primeiro risco</p>
                <p className="mt-2 text-xl font-semibold">{monitoringStats.firstRisk?.date ?? "Sem risco"}</p>
                <p className="text-xs text-muted-foreground">
                  {monitoringStats.firstRisk
                    ? `Falta ${formatCurrency(monitoringStats.firstRisk.shortfall, settings.currency)} para preservar a reserva.`
                    : "Nenhuma quebra de caixa nessa leitura."}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
              Saldo real = nao conta meta so por existir. Se metas baterem = leitura otimista com metas previstas. Contas acumuladas = peso das contas que ja cairam na timeline ate cada dia. Valor para brick = reserva separada para recompra ou patrimonio.
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_340px]">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Projecao de saldo dia a dia</p>
                  <p className="text-xs text-muted-foreground">A leitura cobre no minimo 30 dias e separa saldo real, saldo se metas baterem, contas acumuladas e reserva para brick.</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16 }}
                      formatter={(value: number, key: string) => [formatCurrency(value, settings.currency), key]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="saldoReal" name="Saldo real" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="saldoMetas" name="Se metas baterem" stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    <Line type="monotone" dataKey="contasAcumuladas" name="Contas acumuladas" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="paraBrick" name="Valor para brick" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Dias chave</p>
                  <p className="text-xs text-muted-foreground">Leitura rapida do que acontece na timeline.</p>
                </div>
                <ScrollArea className="h-[280px] rounded-2xl border border-border">
                  <div className="space-y-3 p-3">
                    {keyDays.length === 0 && <p className="text-sm text-muted-foreground">Nenhum movimento importante na janela escolhida.</p>}
                    {keyDays.map((projection) => (
                      <div key={projection.date} className="rounded-xl bg-muted/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{projection.date}</p>
                            <p className="text-xs text-muted-foreground">Saldo {formatCurrency(projection.closing_balance, settings.currency)}</p>
                          </div>
                          <Badge variant={projection.negative ? "destructive" : projection.below_reserve ? "outline" : "secondary"}>
                            {projection.negative ? "Negativo" : projection.below_reserve ? "Reserva" : "Movimento"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">{projection.notes[0] ?? "Sem observacoes automaticas para este dia."}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Entradas vs saidas</p>
                <p className="text-xs text-muted-foreground">Entradas e saidas reais da janela. As metas aparecem separadas para nao inflar a leitura do caixa.</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16 }}
                    formatter={(value: number, key: string) => [formatCurrency(value, settings.currency), key]}
                  />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" name="Saidas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                  {settings.show_goals_on_projection_charts && (
                    <Line type="monotone" dataKey="metas" name="Metas do dia" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Simulacao rapida</CardTitle>
              <p className="text-sm text-muted-foreground">
                Teste venda de brick, atraso de entrada, movimento de conta e novo aporte sem apertar o monitoramento de caixa.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Atrasar entrada</p>
                  <Select value={simulation.delay_income_id ?? "none"} onValueChange={(value) => updateSimulation({ delay_income_id: value === "none" ? null : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma entrada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao simular atraso</SelectItem>
                      {incomes.filter((income) => activeIncomeStatuses.includes(income.status)).map((income) => (
                        <SelectItem key={income.id} value={income.id}>
                          {income.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dias de atraso</p>
                  <Input type="number" min={0} value={simulation.delay_income_days} onChange={(event) => updateSimulation({ delay_income_days: Number(event.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Mover conta</p>
                  <Select value={simulation.shift_bill_id ?? "none"} onValueChange={(value) => updateSimulation({ shift_bill_id: value === "none" ? null : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao mover conta</SelectItem>
                      {bills.filter((bill) => {
                        const status = normalizeBillStatus(bill);
                        return status === "pending" || status === "overdue";
                      }).map((bill) => (
                        <SelectItem key={bill.id} value={bill.id}>
                          {bill.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dias para mover</p>
                  <Input type="number" min={0} value={simulation.shift_bill_days} onChange={(event) => updateSimulation({ shift_bill_days: Number(event.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Novo aporte em brick</p>
                  <Input
                    type="number"
                    min={0}
                    value={simulation.extra_investment_amount || ""}
                    placeholder="Valor do aporte"
                    onChange={(event) => updateSimulation({ extra_investment_amount: Number(event.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Data do aporte</p>
                  <Input
                    type="date"
                    value={simulation.extra_investment_date ?? ""}
                    onChange={(event) => updateSimulation({ extra_investment_date: event.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Retorno esperado do aporte</p>
                <Input
                  type="number"
                  min={0}
                  value={simulation.extra_investment_return_amount || ""}
                  placeholder="Valor de volta esperado"
                  onChange={(event) => updateSimulation({ extra_investment_return_amount: Number(event.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Simular venda de brick</p>
                  <Button variant="ghost" size="sm" onClick={resetSimulation}>
                    Limpar simulacao
                  </Button>
                </div>
                <ScrollArea className="h-40 rounded-2xl border border-border">
                  <div className="space-y-3 p-3">
                    {recommendations.length === 0 && <p className="text-sm text-muted-foreground">Nenhum brick elegivel para simulacao.</p>}
                    {recommendations.map((recommendation) => (
                      <label key={recommendation.brick.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/70 p-3">
                        <Checkbox checked={simulation.selected_brick_ids.includes(recommendation.brick.id)} onCheckedChange={() => toggleBrick(recommendation)} />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{recommendation.brick.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Entra por {formatCurrency(recommendation.estimated_sale_price, settings.currency)} em {recommendation.estimated_sale_date}
                          </p>
                          <p className="text-xs text-muted-foreground">Score {recommendation.score.toFixed(0)} - {recommendation.reasons[0] ?? "Sem observacao extra."}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning-custom" />
                  <p className="text-sm font-medium">Leitura da simulacao</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Pressao do caixa</p>
                    <p className="mt-2 text-lg font-semibold">
                      {simulationResult.summary.day_goes_negative ? `Negativo em ${simulationResult.summary.day_goes_negative}` : "Sem quebra de caixa"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Quanto precisa levantar</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(simulationResult.summary.sale_needed, settings.currency)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {simulationResult.notes.slice(0, 3).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Metas da janela</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lista rapida para voce bater meta sem sair do dashboard.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalChecklist.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  Nenhuma meta de side hustle ou entrada extra ativa dentro da janela atual.
                </div>
              )}
              {goalChecklist.map((item) => (
                <div key={item.target.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{item.target.title}</p>
                        <Badge variant={item.status === "hit" ? "secondary" : item.status === "projected" ? "outline" : "destructive"}>
                          {item.status === "hit" ? "Batida" : item.status === "projected" ? "No projetado" : "Pendente"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>Valor {formatCurrency(item.totalTarget, settings.currency)}</span>
                        {item.target.completed_at && <span>Batida em {item.target.completed_at}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.target.status === "completed" ? (
                        <Button variant="outline" size="sm" onClick={() => void reopenMonthlyTarget(item.target.id)} disabled={isSyncing}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Desfazer
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => void completeMonthlyTarget(item.target.id)} disabled={isSyncing}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Marcar batida
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Caixa disponivel" value={formatCurrency(displayedCurrentCash, settings.currency)} description="Saldo apurado com movimentos confirmados ate hoje." icon={DollarSign} tone={displayedCurrentCash >= settings.minimum_cash_reserve ? "positive" : "warning"} />
        <MetricCard title="Entradas previstas" value={formatCurrency(summary.total_expected_income, settings.currency)} description="Somatorio das entradas futuras cadastradas." icon={ArrowDownCircle} tone="positive" />
        <MetricCard title="Capital travado" value={formatCurrency(summary.locked_in_bricks, settings.currency)} description="Bricks ainda nao liquidados." icon={Box} />
        <MetricCard title="Necessidade de venda" value={formatCurrency(summary.sale_needed, settings.currency)} description={summary.critical_due_date ? `Primeira pressao em ${summary.critical_due_date}.` : "Nenhuma venda obrigatoria no horizonte base."} icon={Wallet} tone={summary.sale_needed > 0 ? "warning" : "positive"} />
        <MetricCard title="Projecao 7d" value={formatCurrency(summary.projected_cash_7d, settings.currency)} description="Saldo no setimo dia corrido." icon={CalendarClock} tone={summary.projected_cash_7d < settings.minimum_cash_reserve ? "warning" : "default"} />
        <MetricCard title="Projecao 30d" value={formatCurrency(summary.projected_cash_30d, settings.currency)} description="Horizonte base de 30 dias." icon={TrendingUp} tone={summary.projected_cash_30d < 0 ? "negative" : "default"} />
        <MetricCard title="Lucro do mes" value={formatCurrency(summary.month_profit, settings.currency)} description="Lucro liquido das vendas confirmadas no mes." icon={ArrowUpCircle} tone={summary.month_profit >= 0 ? "positive" : "negative"} />
        <MetricCard title="Planejamento mensal" value={formatCurrency(summary.monthly_planning.net_bills_after_goals, settings.currency)} description="Contas do mes depois do abatimento por metas." icon={Target} tone={summary.monthly_planning.net_bills_after_goals > 0 ? "warning" : "positive"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas da leitura atual</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              <div className="space-y-3">
                {monitoringAlerts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    Nenhum alerta critico dentro da janela atual.
                  </div>
                )}
                {monitoringAlerts.map((alert) => (
                  <div key={`${alert.type}-${alert.reference_id ?? alert.title}`} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                      <Badge variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "outline" : "secondary"}>
                        {alert.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking pratico de venda</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              <div className="space-y-3">
                {recommendations.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    Sem bricks elegiveis para venda agora.
                  </div>
                )}
                {recommendations.map((recommendation) => (
                  <div key={recommendation.brick.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{recommendation.brick.name}</p>
                        <p className="text-xs text-muted-foreground">Liquidez {recommendation.liquidity_score.toFixed(0)} - risco {recommendation.risk_score.toFixed(0)}</p>
                      </div>
                      <Badge variant="outline">Score {recommendation.score.toFixed(0)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div className="rounded-xl bg-muted/70 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Entra no caixa</p>
                        <p className="mt-2 font-semibold">{formatCurrency(recommendation.estimated_sale_price, settings.currency)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/70 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cobertura estimada</p>
                        <p className="mt-2 font-semibold">{recommendation.coverage_until ?? "Nao cobre sozinho"}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {recommendation.reasons.slice(0, 3).map((reason) => (
                        <div key={reason} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Janela atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>De {monitoringWindow.startDate} ate {monitoringWindow.endDate}.</p>
            <p>Entradas na janela: {formatCurrency(monitoringStats.inflows, settings.currency)}.</p>
            <p>Saidas na janela: {formatCurrency(monitoringStats.outflows, settings.currency)}.</p>
            <p>A linha azul agora ignora contas de meses fora da janela.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leitura mensal liquida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Contas do mes: {formatCurrency(summary.monthly_planning.month_bills_total, settings.currency)}.</p>
            <p>Metas de entrada: {formatCurrency(summary.monthly_planning.goal_income_total, settings.currency)}.</p>
            <p>Contas liquidas: {formatCurrency(summary.monthly_planning.net_bills_after_goals, settings.currency)}.</p>
            <p>Meta de reserva: {formatCurrency(summary.monthly_planning.reserve_goal, settings.currency)}.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monitoramento rapido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{summary.day_goes_negative ? `Sem agir, o caixa quebra em ${summary.day_goes_negative}.` : "Sem quebra prevista no horizonte base."}</p>
            <p>{simulationResult.summary.day_goes_negative ? `Com a simulacao atual, a pressao continua em ${simulationResult.summary.day_goes_negative}.` : "Com a simulacao atual, a janela monitorada nao quebra o caixa."}</p>
            <p>{summary.sale_needed > 0 ? `Hoje o painel estima necessidade de levantar ${formatCurrency(summary.sale_needed, settings.currency)}.` : "Hoje nao ha necessidade de vender ativo para cobrir contas."}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
