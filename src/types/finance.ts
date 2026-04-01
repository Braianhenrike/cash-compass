// ===== ENUMS =====
export type BillStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type BillPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export type IncomeType = 'side_hustle' | 'salary' | 'brick_sale' | 'investment_return' | 'transfer' | 'extra';
export type IncomeStatus = 'expected' | 'confirmed' | 'received' | 'cancelled';

export type BrickStatus = 'planned' | 'purchased' | 'listed' | 'reserved' | 'sold' | 'cancelled' | 'loss';
export type BrickLiquidity = 'high' | 'medium' | 'low';
export type BrickRisk = 'low' | 'medium' | 'high';
export type BrickRating = 'bad' | 'good' | 'excellent';
export type BrickCostType = 'shipping' | 'maintenance' | 'transport' | 'commission' | 'fees' | 'accessories' | 'other';

export type AlertType = 'bill_due' | 'bill_overdue' | 'cash_negative' | 'cash_below_reserve' | 'brick_stale' | 'sale_below_min' | 'excess_locked' | 'bills_before_income';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export type ScenarioType = 'conservative' | 'probable' | 'optimistic';

// ===== INTERFACES =====
export interface Category {
  id: string;
  type: 'bill' | 'income' | 'brick';
  name: string;
}

export interface Bill {
  id: string;
  description: string;
  category_id: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType;
  priority: BillPriority;
  status: BillStatus;
  notes: string;
  created_at: string;
}

export interface Income {
  id: string;
  type: IncomeType;
  description: string;
  amount: number;
  expected_date: string;
  received_date: string | null;
  status: IncomeStatus;
  notes: string;
  created_at: string;
}

export interface BrickItem {
  id: string;
  name: string;
  category_id: string | null;
  purchase_price: number;
  target_sale_price: number;
  minimum_sale_price: number;
  probable_sale_price: number;
  purchase_date: string;
  expected_sale_date: string | null;
  actual_sale_date: string | null;
  actual_sale_price: number | null;
  liquidity: BrickLiquidity;
  risk_level: BrickRisk;
  status: BrickStatus;
  sales_channel: string;
  notes: string;
  rating: BrickRating | null;
  created_at: string;
  costs: BrickCost[];
}

export interface BrickCost {
  id: string;
  brick_item_id: string;
  type: BrickCostType;
  amount: number;
  notes: string;
}

export interface Settings {
  minimum_cash_reserve: number;
  currency: string;
  default_scenario: ScenarioType;
  alerts_enabled: boolean;
  stale_brick_days: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DailyProjection {
  date: string;
  opening_balance: number;
  expected_income: number;
  confirmed_income: number;
  expected_expenses: number;
  confirmed_expenses: number;
  closing_balance: number;
  below_reserve: boolean;
  negative: boolean;
  needs_sale: boolean;
  shortfall: number;
}

export interface ScenarioConfig {
  id: string;
  name: ScenarioType;
  sale_price_multiplier: number;
  sale_delay_days: number;
  expected_income_multiplier: number;
}

// ===== COMPUTED =====
export interface BrickMetrics {
  total_invested: number;
  gross_profit: number;
  net_profit: number;
  roi_percent: number;
  days_locked: number;
  profit_per_day: number;
  margin_percent: number;
}

export interface CashSummary {
  available_cash: number;
  projected_cash_7d: number;
  projected_cash_15d: number;
  projected_cash_30d: number;
  total_pending_bills: number;
  total_expected_income: number;
  locked_in_bricks: number;
  month_profit: number;
  bills_at_risk: number;
  sale_needed: number;
  day_goes_negative: string | null;
}
