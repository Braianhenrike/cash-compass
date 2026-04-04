export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          description: string;
          due_date: string;
          id: string;
          is_recurring: boolean;
          notes: string;
          paid_date: string | null;
          priority: Database["public"]["Enums"]["bill_priority"];
          recurrence_type: Database["public"]["Enums"]["recurrence_type"];
          status: Database["public"]["Enums"]["bill_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          description: string;
          due_date: string;
          id?: string;
          is_recurring?: boolean;
          notes?: string;
          paid_date?: string | null;
          priority?: Database["public"]["Enums"]["bill_priority"];
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"];
          status?: Database["public"]["Enums"]["bill_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          due_date?: string;
          id?: string;
          is_recurring?: boolean;
          notes?: string;
          paid_date?: string | null;
          priority?: Database["public"]["Enums"]["bill_priority"];
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"];
          status?: Database["public"]["Enums"]["bill_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_payable_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_read: boolean;
          reference_id: string | null;
          reference_type: string | null;
          severity: Database["public"]["Enums"]["alert_severity"];
          title: string;
          type: Database["public"]["Enums"]["alert_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          is_read?: boolean;
          reference_id?: string | null;
          reference_type?: string | null;
          severity: Database["public"]["Enums"]["alert_severity"];
          title: string;
          type: Database["public"]["Enums"]["alert_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_read?: boolean;
          reference_id?: string | null;
          reference_type?: string | null;
          severity?: Database["public"]["Enums"]["alert_severity"];
          title?: string;
          type?: Database["public"]["Enums"]["alert_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          action: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          payload: Json | null;
          summary: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          payload?: Json | null;
          summary: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          payload?: Json | null;
          summary?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      brick_costs: {
        Row: {
          amount: number;
          brick_item_id: string;
          created_at: string;
          id: string;
          notes: string;
          type: Database["public"]["Enums"]["brick_cost_type"];
        };
        Insert: {
          amount: number;
          brick_item_id: string;
          created_at?: string;
          id?: string;
          notes?: string;
          type: Database["public"]["Enums"]["brick_cost_type"];
        };
        Update: {
          amount?: number;
          brick_item_id?: string;
          created_at?: string;
          id?: string;
          notes?: string;
          type?: Database["public"]["Enums"]["brick_cost_type"];
        };
        Relationships: [
          {
            foreignKeyName: "brick_costs_brick_item_id_fkey";
            columns: ["brick_item_id"];
            isOneToOne: false;
            referencedRelation: "brick_items";
            referencedColumns: ["id"];
          },
        ];
      };
      brick_items: {
        Row: {
          actual_sale_date: string | null;
          actual_sale_price: number | null;
          category_id: string | null;
          created_at: string;
          expected_sale_date: string | null;
          id: string;
          liquidity: Database["public"]["Enums"]["brick_liquidity"];
          minimum_sale_price: number;
          name: string;
          notes: string;
          probable_sale_price: number;
          purchase_affects_cash_flow: boolean;
          purchase_channel: string;
          purchase_date: string;
          purchase_price: number;
          rating: Database["public"]["Enums"]["brick_rating"] | null;
          reserve_invested_capital: boolean;
          reserve_profit_for_reinvestment: boolean;
          risk_level: Database["public"]["Enums"]["brick_risk"];
          sales_channel: string;
          status: Database["public"]["Enums"]["brick_status"];
          target_sale_price: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actual_sale_date?: string | null;
          actual_sale_price?: number | null;
          category_id?: string | null;
          created_at?: string;
          expected_sale_date?: string | null;
          id?: string;
          liquidity?: Database["public"]["Enums"]["brick_liquidity"];
          minimum_sale_price?: number;
          name: string;
          notes?: string;
          probable_sale_price?: number;
          purchase_affects_cash_flow?: boolean;
          purchase_channel?: string;
          purchase_date: string;
          purchase_price: number;
          rating?: Database["public"]["Enums"]["brick_rating"] | null;
          reserve_invested_capital?: boolean;
          reserve_profit_for_reinvestment?: boolean;
          risk_level?: Database["public"]["Enums"]["brick_risk"];
          sales_channel?: string;
          status?: Database["public"]["Enums"]["brick_status"];
          target_sale_price?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actual_sale_date?: string | null;
          actual_sale_price?: number | null;
          category_id?: string | null;
          created_at?: string;
          expected_sale_date?: string | null;
          id?: string;
          liquidity?: Database["public"]["Enums"]["brick_liquidity"];
          minimum_sale_price?: number;
          name?: string;
          notes?: string;
          probable_sale_price?: number;
          purchase_affects_cash_flow?: boolean;
          purchase_channel?: string;
          purchase_date?: string;
          purchase_price?: number;
          rating?: Database["public"]["Enums"]["brick_rating"] | null;
          reserve_invested_capital?: boolean;
          reserve_profit_for_reinvestment?: boolean;
          risk_level?: Database["public"]["Enums"]["brick_risk"];
          sales_channel?: string;
          status?: Database["public"]["Enums"]["brick_status"];
          target_sale_price?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brick_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          type: Database["public"]["Enums"]["category_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          type: Database["public"]["Enums"]["category_type"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["category_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      income_entries: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          description: string;
          expected_date: string;
          id: string;
          notes: string;
          received_date: string | null;
          source: string;
          status: Database["public"]["Enums"]["income_status"];
          type: Database["public"]["Enums"]["income_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          description: string;
          expected_date: string;
          id?: string;
          notes?: string;
          received_date?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["income_status"];
          type: Database["public"]["Enums"]["income_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          expected_date?: string;
          id?: string;
          notes?: string;
          received_date?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["income_status"];
          type?: Database["public"]["Enums"]["income_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "income_entries_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_targets: {
        Row: {
          amount: number;
          applies_to_cashflow: boolean;
          completed_at: string | null;
          created_at: string;
          expected_date: string | null;
          id: string;
          is_active: boolean;
          month_ref: string;
          notes: string;
          offsets_monthly_bills: boolean;
          recurrence_mode: string;
          recurrence_occurrences: number | null;
          recurrence_weekdays: number[];
          status: string;
          title: string;
          type: Database["public"]["Enums"]["monthly_target_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          applies_to_cashflow?: boolean;
          completed_at?: string | null;
          created_at?: string;
          expected_date?: string | null;
          id?: string;
          is_active?: boolean;
          month_ref: string;
          notes?: string;
          offsets_monthly_bills?: boolean;
          recurrence_mode?: string;
          recurrence_occurrences?: number | null;
          recurrence_weekdays?: number[];
          status?: string;
          title: string;
          type: Database["public"]["Enums"]["monthly_target_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          applies_to_cashflow?: boolean;
          completed_at?: string | null;
          created_at?: string;
          expected_date?: string | null;
          id?: string;
          is_active?: boolean;
          month_ref?: string;
          notes?: string;
          offsets_monthly_bills?: boolean;
          recurrence_mode?: string;
          recurrence_occurrences?: number | null;
          recurrence_weekdays?: number[];
          status?: string;
          title?: string;
          type?: Database["public"]["Enums"]["monthly_target_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scenario_configs: {
        Row: {
          created_at: string;
          expected_income_multiplier: number;
          id: string;
          name: Database["public"]["Enums"]["scenario_type"];
          sale_delay_days: number;
          sale_price_multiplier: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expected_income_multiplier: number;
          id?: string;
          name: Database["public"]["Enums"]["scenario_type"];
          sale_delay_days: number;
          sale_price_multiplier: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expected_income_multiplier?: number;
          id?: string;
          name?: Database["public"]["Enums"]["scenario_type"];
          sale_delay_days?: number;
          sale_price_multiplier?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          alerts_enabled: boolean;
          bill_due_alert_days: number;
          created_at: string;
          currency: string;
          current_cash_balance: number;
          default_goal_day: number;
          default_bill_priority: Database["public"]["Enums"]["bill_priority"];
          default_scenario: Database["public"]["Enums"]["scenario_type"];
          goals_affect_cashflow: boolean;
          goals_reduce_month_bills: boolean;
          id: string;
          minimum_cash_reserve: number;
          show_goals_on_projection_charts: boolean;
          stale_brick_days: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alerts_enabled?: boolean;
          bill_due_alert_days?: number;
          created_at?: string;
          currency?: string;
          current_cash_balance?: number;
          default_goal_day?: number;
          default_bill_priority?: Database["public"]["Enums"]["bill_priority"];
          default_scenario?: Database["public"]["Enums"]["scenario_type"];
          goals_affect_cashflow?: boolean;
          goals_reduce_month_bills?: boolean;
          id?: string;
          minimum_cash_reserve?: number;
          show_goals_on_projection_charts?: boolean;
          stale_brick_days?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alerts_enabled?: boolean;
          bill_due_alert_days?: number;
          created_at?: string;
          currency?: string;
          current_cash_balance?: number;
          default_goal_day?: number;
          default_bill_priority?: Database["public"]["Enums"]["bill_priority"];
          default_scenario?: Database["public"]["Enums"]["scenario_type"];
          goals_affect_cashflow?: boolean;
          goals_reduce_month_bills?: boolean;
          id?: string;
          minimum_cash_reserve?: number;
          show_goals_on_projection_charts?: boolean;
          stale_brick_days?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      monthly_finance_overview: {
        Row: {
          confirmed_brick_returns: number | null;
          confirmed_expenses: number | null;
          confirmed_income: number | null;
          expected_expenses: number | null;
          expected_income: number | null;
          month_ref: string | null;
          planned_brick_investment: number | null;
          projected_brick_returns: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<PropertyKey, never>;
    Enums: {
      alert_severity: "info" | "warning" | "critical";
      alert_type:
        | "bill_due"
        | "bill_overdue"
        | "cash_negative"
        | "cash_below_reserve"
        | "brick_stale"
        | "sale_below_min"
        | "excess_locked"
        | "bills_before_income";
      bill_priority: "low" | "medium" | "high" | "critical";
      bill_status: "pending" | "paid" | "overdue" | "cancelled";
      brick_cost_type: "shipping" | "maintenance" | "transport" | "commission" | "fees" | "accessories" | "other";
      brick_liquidity: "high" | "medium" | "low";
      brick_rating: "bad" | "good" | "excellent";
      brick_risk: "low" | "medium" | "high";
      brick_status: "planned" | "purchased" | "listed" | "reserved" | "sold" | "cancelled" | "loss";
      category_type: "bill" | "income" | "brick";
      income_status: "expected" | "confirmed" | "received" | "cancelled";
      income_type: "side_hustle" | "salary" | "brick_sale" | "investment_return" | "transfer" | "extra";
      monthly_target_type:
        | "side_hustle_goal"
        | "extra_income_goal"
        | "expense_cap"
        | "reinvestment_cap"
        | "reserve_goal";
      recurrence_type: "none" | "weekly" | "monthly" | "yearly";
      scenario_type: "conservative" | "probable" | "optimistic";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Row: infer Row }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Row: infer Row }
      ? Row
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer Insert }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer Insert }
      ? Insert
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer Update }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer Update }
      ? Update
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
