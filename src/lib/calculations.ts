import { Bill, BrickItem, BrickMetrics, CashSummary, DailyProjection, Income, Settings } from '@/types/finance';
import { addDays, differenceInDays, format, isAfter, isBefore, isToday, parseISO, startOfDay } from 'date-fns';

export function calcBrickMetrics(brick: BrickItem): BrickMetrics {
  const totalCosts = brick.costs.reduce((sum, c) => sum + c.amount, 0);
  const total_invested = brick.purchase_price + totalCosts;
  const salePrice = brick.actual_sale_price ?? brick.probable_sale_price;
  const gross_profit = salePrice - brick.purchase_price;
  const net_profit = salePrice - total_invested;
  const roi_percent = total_invested > 0 ? (net_profit / total_invested) * 100 : 0;
  const margin_percent = salePrice > 0 ? (net_profit / salePrice) * 100 : 0;
  
  const endDate = brick.actual_sale_date ? parseISO(brick.actual_sale_date) : new Date();
  const days_locked = Math.max(1, differenceInDays(endDate, parseISO(brick.purchase_date)));
  const profit_per_day = net_profit / days_locked;

  return { total_invested, gross_profit, net_profit, roi_percent, days_locked, profit_per_day, margin_percent };
}

export function calcTotalInvested(brick: BrickItem): number {
  return brick.purchase_price + brick.costs.reduce((s, c) => s + c.amount, 0);
}

export function calcLockedCapital(bricks: BrickItem[]): number {
  return bricks
    .filter(b => ['purchased', 'listed', 'reserved', 'planned'].includes(b.status))
    .reduce((sum, b) => sum + calcTotalInvested(b), 0);
}

export function calcDailyProjections(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  settings: Settings,
  days: number = 30
): DailyProjection[] {
  const today = startOfDay(new Date());
  const projections: DailyProjection[] = [];
  let runningBalance = currentCash;

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const opening = runningBalance;

    const dayBills = bills.filter(b => b.due_date === dateStr && b.status !== 'paid' && b.status !== 'cancelled');
    const dayIncomes = incomes.filter(inc => {
      if (inc.status === 'received') return inc.received_date === dateStr;
      return inc.expected_date === dateStr && inc.status !== 'cancelled';
    });

    const expected_expenses = dayBills.reduce((s, b) => s + b.amount, 0);
    const confirmed_expenses = dayBills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
    const expected_income = dayIncomes.filter(inc => inc.status === 'expected' || inc.status === 'confirmed').reduce((s, inc) => s + inc.amount, 0);
    const confirmed_income = dayIncomes.filter(inc => inc.status === 'received').reduce((s, inc) => s + inc.amount, 0);

    const closing = opening + expected_income + confirmed_income - expected_expenses;
    const below_reserve = closing < settings.minimum_cash_reserve;
    const negative = closing < 0;
    const shortfall = negative ? Math.abs(closing) : (below_reserve ? settings.minimum_cash_reserve - closing : 0);

    projections.push({
      date: dateStr,
      opening_balance: opening,
      expected_income,
      confirmed_income,
      expected_expenses,
      confirmed_expenses,
      closing_balance: closing,
      below_reserve,
      negative,
      needs_sale: negative || below_reserve,
      shortfall,
    });

    runningBalance = closing;
  }

  return projections;
}

export function calcCashSummary(
  currentCash: number,
  bills: Bill[],
  incomes: Income[],
  bricks: BrickItem[],
  settings: Settings
): CashSummary {
  const today = startOfDay(new Date());
  const projections = calcDailyProjections(currentCash, bills, incomes, settings, 30);

  const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'overdue');
  const expectedIncomes = incomes.filter(i => i.status === 'expected' || i.status === 'confirmed');
  
  const lockedBricks = bricks.filter(b => ['purchased', 'listed', 'reserved', 'planned'].includes(b.status));
  const soldThisMonth = bricks.filter(b => {
    if (b.status !== 'sold' || !b.actual_sale_date) return false;
    const d = parseISO(b.actual_sale_date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const monthProfit = soldThisMonth.reduce((sum, b) => sum + calcBrickMetrics(b).net_profit, 0);
  
  const billsAtRisk = pendingBills.filter(b => {
    const proj = projections.find(p => p.date === b.due_date);
    return proj && proj.closing_balance < 0;
  }).length;

  const negDay = projections.find(p => p.negative);
  const saleNeeded = negDay ? negDay.shortfall : 0;

  return {
    available_cash: currentCash,
    projected_cash_7d: projections[6]?.closing_balance ?? currentCash,
    projected_cash_15d: projections[14]?.closing_balance ?? currentCash,
    projected_cash_30d: projections[29]?.closing_balance ?? currentCash,
    total_pending_bills: pendingBills.reduce((s, b) => s + b.amount, 0),
    total_expected_income: expectedIncomes.reduce((s, i) => s + i.amount, 0),
    locked_in_bricks: calcLockedCapital(bricks),
    month_profit: monthProfit,
    bills_at_risk: billsAtRisk,
    sale_needed: saleNeeded,
    day_goes_negative: negDay?.date ?? null,
  };
}

export function suggestSales(bricks: BrickItem[], amountNeeded: number): BrickItem[] {
  const sellable = bricks
    .filter(b => ['purchased', 'listed', 'reserved'].includes(b.status))
    .map(b => {
      const metrics = calcBrickMetrics(b);
      const liquidityScore = b.liquidity === 'high' ? 3 : b.liquidity === 'medium' ? 2 : 1;
      const riskScore = b.risk_level === 'low' ? 3 : b.risk_level === 'medium' ? 2 : 1;
      const profitScore = metrics.net_profit > 0 ? 2 : metrics.net_profit === 0 ? 1 : 0;
      const score = liquidityScore * 3 + riskScore * 2 + profitScore;
      return { brick: b, score, saleValue: b.probable_sale_price };
    })
    .sort((a, b) => b.score - a.score);

  const result: BrickItem[] = [];
  let accumulated = 0;
  for (const item of sellable) {
    if (accumulated >= amountNeeded) break;
    result.push(item.brick);
    accumulated += item.saleValue;
  }
  return result;
}

export function generateAlerts(
  bills: Bill[],
  bricks: BrickItem[],
  projections: DailyProjection[],
  settings: Settings
) {
  const alerts: Omit<Alert, 'id' | 'created_at' | 'is_read'>[] = [];
  const today = format(new Date(), 'yyyy-MM-dd');

  // Overdue bills
  bills.filter(b => b.status === 'pending' && b.due_date < today).forEach(b => {
    alerts.push({
      type: 'bill_overdue', severity: 'critical',
      title: `Conta vencida: ${b.description}`,
      description: `R$ ${b.amount.toFixed(2)} venceu em ${b.due_date}`,
      reference_id: b.id,
    });
  });

  // Bills due in 3 days
  const in3days = format(addDays(new Date(), 3), 'yyyy-MM-dd');
  bills.filter(b => b.status === 'pending' && b.due_date >= today && b.due_date <= in3days).forEach(b => {
    alerts.push({
      type: 'bill_due', severity: 'warning',
      title: `Conta vence em breve: ${b.description}`,
      description: `R$ ${b.amount.toFixed(2)} vence em ${b.due_date}`,
      reference_id: b.id,
    });
  });

  // Cash negative
  const negDay = projections.find(p => p.negative);
  if (negDay) {
    alerts.push({
      type: 'cash_negative', severity: 'critical',
      title: 'Caixa ficará negativo',
      description: `Projeção indica caixa negativo em ${negDay.date} (R$ ${negDay.closing_balance.toFixed(2)})`,
      reference_id: null,
    });
  }

  // Below reserve
  const belowRes = projections.find(p => p.below_reserve && !p.negative);
  if (belowRes) {
    alerts.push({
      type: 'cash_below_reserve', severity: 'warning',
      title: 'Caixa abaixo da reserva',
      description: `Em ${belowRes.date}, caixa cai para R$ ${belowRes.closing_balance.toFixed(2)}`,
      reference_id: null,
    });
  }

  // Stale bricks
  bricks.filter(b => ['purchased', 'listed'].includes(b.status)).forEach(b => {
    const days = differenceInDays(new Date(), parseISO(b.purchase_date));
    if (days > settings.stale_brick_days) {
      alerts.push({
        type: 'brick_stale', severity: 'info',
        title: `Brick parado: ${b.name}`,
        description: `${days} dias desde a compra sem venda`,
        reference_id: b.id,
      });
    }
  });

  return alerts;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

import type { Alert } from '@/types/finance';
