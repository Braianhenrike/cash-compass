export type BillStatus = "pending" | "paid" | "overdue" | "cancelled";
export type BillPriority = "low" | "medium" | "high" | "critical";
export type RecurrenceType = "none" | "weekly" | "monthly" | "yearly";

export type IncomeType =
  | "side_hustle"
  | "salary"
  | "brick_sale"
  | "investment_return"
  | "transfer"
  | "extra";
export type IncomeStatus = "expected" | "confirmed" | "received" | "cancelled";

export type BrickStatus = "planned" | "purchased" | "listed" | "reserved" | "sold" | "cancelled" | "loss";
export type BrickLiquidity = "high" | "medium" | "low";
export type BrickRisk = "low" | "medium" | "high";
export type BrickRating = "bad" | "good" | "excellent";
export type BrickCostType =
  | "shipping"
  | "maintenance"
  | "transport"
  | "commission"
  | "fees"
  | "accessories"
  | "other";

export type AlertType =
  | "bill_due"
  | "bill_overdue"
  | "cash_negative"
  | "cash_below_reserve"
  | "brick_stale"
  | "sale_below_min"
  | "excess_locked"
  | "bills_before_income";
export type AlertSeverity = "info" | "warning" | "critical";

export type ScenarioType = "conservative" | "probable" | "optimistic";
export type CategoryType = "bill" | "income" | "brick";
export type ProjectionRiskLevel = "safe" | "reserve" | "negative";
export type MonthlyTargetType =
  | "side_hustle_goal"
  | "extra_income_goal"
  | "expense_cap"
  | "reinvestment_cap"
  | "reserve_goal";
export type MonthlyTargetRecurrenceMode = "single" | "weekly";
export type MonthlyTargetStatus = "pending" | "completed";
export type AuditEntityType =
  | "settings"
  | "category"
  | "bill"
  | "income"
  | "brick"
  | "scenario"
  | "import"
  | "monthly_target";
export type AuditAction = "create" | "update" | "delete" | "import" | "seed";
export type ImportedEntryKind = "income" | "bill" | "planned_investment";

export interface Category {
  id: string;
  type: CategoryType;
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
  updated_at?: string;
}

export interface Income {
  id: string;
  type: IncomeType;
  category_id: string | null;
  description: string;
  amount: number;
  expected_date: string;
  received_date: string | null;
  status: IncomeStatus;
  source: string;
  notes: string;
  created_at: string;
  updated_at?: string;
}

export interface BrickCost {
  id: string;
  brick_item_id: string;
  type: BrickCostType;
  amount: number;
  notes: string;
  created_at?: string;
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
  purchase_affects_cash_flow: boolean;
  reserve_invested_capital: boolean;
  reserve_profit_for_reinvestment: boolean;
  purchase_channel: string;
  sales_channel: string;
  notes: string;
  rating: BrickRating | null;
  created_at: string;
  updated_at?: string;
  costs: BrickCost[];
}

export interface Settings {
  minimum_cash_reserve: number;
  currency: string;
  default_scenario: ScenarioType;
  alerts_enabled: boolean;
  stale_brick_days: number;
  current_cash_balance: number;
  bill_due_alert_days: number;
  default_bill_priority: BillPriority;
  goals_affect_cashflow: boolean;
  goals_reduce_month_bills: boolean;
  default_goal_day: number;
  show_goals_on_projection_charts: boolean;
}

export interface MonthlyTarget {
  id: string;
  month_ref: string;
  title: string;
  type: MonthlyTargetType;
  amount: number;
  expected_date: string | null;
  applies_to_cashflow: boolean;
  offsets_monthly_bills: boolean;
  is_active: boolean;
  status: MonthlyTargetStatus;
  completed_at: string | null;
  recurrence_mode: MonthlyTargetRecurrenceMode;
  recurrence_weekdays: number[];
  recurrence_occurrences: number | null;
  notes: string;
  created_at: string;
  updated_at?: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  reference_type?: string | null;
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
  expected_brick_income: number;
  confirmed_brick_income: number;
  planned_brick_investment: number;
  total_expected_inflows: number;
  total_confirmed_inflows: number;
  total_expected_outflows: number;
  total_confirmed_outflows: number;
  committed_cash: number;
  free_cash_after_commitments: number;
  closing_balance: number;
  below_reserve: boolean;
  negative: boolean;
  needs_sale: boolean;
  shortfall: number;
  risk_level: ProjectionRiskLevel;
  notes: string[];
}

export interface BrickReserveProjection {
  date: string;
  reserved_cash: number;
  protected_sale_total: number;
  reserve_used_in_bricks: number;
}

export interface ScenarioConfig {
  id: string;
  name: ScenarioType;
  sale_price_multiplier: number;
  sale_delay_days: number;
  expected_income_multiplier: number;
}

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
  committed_cash: number;
  free_cash: number;
  projected_cash_7d: number;
  projected_cash_15d: number;
  projected_cash_30d: number;
  projected_inflows_30d: number;
  total_pending_bills: number;
  total_expected_income: number;
  locked_in_bricks: number;
  planned_brick_investment: number;
  expected_brick_returns: number;
  month_profit: number;
  bills_at_risk: number;
  sale_needed: number;
  critical_due_date: string | null;
  day_goes_negative: string | null;
  monthly_planning: MonthlyPlanningMetrics;
}

export interface MonthlyPlanningMetrics {
  month_label: string;
  month_ref: string;
  month_bills_total: number;
  forecast_income_total: number;
  goal_income_total: number;
  bill_offset_total: number;
  net_bills_after_goals: number;
  expense_cap: number;
  expense_cap_variance: number;
  planned_reinvestment_total: number;
  reinvestment_cap: number;
  reinvestment_cap_variance: number;
  reserve_goal: number;
  reserve_gap: number;
}

export interface SaleRecommendation {
  brick: BrickItem;
  score: number;
  liquidity_score: number;
  risk_score: number;
  profit_score: number;
  urgency_score: number;
  trapped_capital_score: number;
  downside_risk: number;
  estimated_sale_price: number;
  estimated_sale_date: string;
  projected_relief: number;
  coverage_until: string | null;
  reasons: string[];
}

export interface SimulationConfig {
  selected_scenario: ScenarioType;
  selected_brick_ids: string[];
  delay_income_id: string | null;
  delay_income_days: number;
  extra_investment_amount: number;
  extra_investment_date: string | null;
  extra_investment_return_amount: number;
  shift_bill_id: string | null;
  shift_bill_days: number;
}

export interface SimulationResult {
  projections: DailyProjection[];
  summary: CashSummary;
  sale_recommendations: SaleRecommendation[];
  notes: string[];
}

export interface MonthlyFlowPoint {
  month: string;
  expected_income: number;
  confirmed_income: number;
  expected_expenses: number;
  confirmed_expenses: number;
  goal_income: number;
  net_expenses_after_goals: number;
  expense_cap: number;
  reinvestment_cap: number;
  reserve_goal: number;
  projected_brick_returns: number;
  confirmed_brick_returns: number;
  brick_profit_real: number;
  locked_capital: number;
  free_cash_projection: number;
}

export interface PlannedVsActualPoint {
  label: string;
  planned: number;
  actual: number;
  variance: number;
}

export interface BrickPerformanceRow {
  brick: BrickItem;
  metrics: BrickMetrics;
  liquidity_score: number;
}

export interface ReportSnapshot {
  monthly_flow: MonthlyFlowPoint[];
  income_planned_vs_actual: PlannedVsActualPoint[];
  sales_planned_vs_actual: PlannedVsActualPoint[];
  top_profit_bricks: BrickPerformanceRow[];
  fastest_bricks: BrickPerformanceRow[];
  capital_evolution: Array<{ month: string; value: number }>;
  free_cash_evolution: Array<{ label: string; value: number }>;
  profitability_by_category: Array<{ name: string; value: number }>;
  turnover_ratio: number;
  best_category: string | null;
}

export interface FinanceData {
  settings: Settings;
  categories: Category[];
  bills: Bill[];
  incomes: Income[];
  bricks: BrickItem[];
  monthly_targets: MonthlyTarget[];
  scenarios: ScenarioConfig[];
  audit_events: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  user_id?: string;
  entity_type: AuditEntityType;
  entity_id: string | null;
  action: AuditAction;
  summary: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ImportedTemplateEntry {
  id: string;
  kind: ImportedEntryKind;
  label: string;
  amount: number;
  month_label: string;
  date: string;
  day: number | null;
  source_row: number;
  notes: string;
}

export interface ImportedMonthlyBalance {
  month_label: string;
  month_number: number;
  monthly_result: number | null;
  cash_balance: number | null;
}

export interface ImportPreviewSummary {
  income_count: number;
  bill_count: number;
  planned_investment_count: number;
  total_income: number;
  total_bills: number;
  total_planned_investment: number;
  last_cash_balance: number | null;
}

export interface ImportPreview {
  base_year: number;
  sheet_name: string;
  entries: ImportedTemplateEntry[];
  monthly_balances: ImportedMonthlyBalance[];
  summary: ImportPreviewSummary;
}

export interface ImportExecutionOptions {
  replace_existing_imports: boolean;
  update_current_cash_from_sheet: boolean;
}

export interface ImportExecutionResult {
  created_bills: number;
  created_incomes: number;
  created_bricks: number;
  updated_current_cash: boolean;
}
