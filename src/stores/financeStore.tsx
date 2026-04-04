import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getFriendlyErrorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import {
  addBill as addBillRecord,
  addBrick as addBrickRecord,
  addBrickCost as addBrickCostRecord,
  addCategory as addCategoryRecord,
  addIncome as addIncomeRecord,
  addMonthlyTarget as addMonthlyTargetRecord,
  addMonthlyTargets as addMonthlyTargetsRecord,
  completeMonthlyTarget as completeMonthlyTargetRecord,
  deleteBill as deleteBillRecord,
  deleteBrick as deleteBrickRecord,
  deleteBrickCost as deleteBrickCostRecord,
  deleteCategory as deleteCategoryRecord,
  deleteIncome as deleteIncomeRecord,
  deleteMonthlyTarget as deleteMonthlyTargetRecord,
  fetchFinanceData,
  reopenMonthlyTarget as reopenMonthlyTargetRecord,
  updateScenarioConfig as updateScenarioConfigRecord,
  updateBill as updateBillRecord,
  updateBrick as updateBrickRecord,
  updateCurrentCash,
  updateIncome as updateIncomeRecord,
  updateMonthlyTarget as updateMonthlyTargetRecord,
  updateSettings as updateSettingsRecord,
} from "@/services/finance";
import { executeTemplateImport } from "@/services/imports";
import type {
  AuditEvent,
  Bill,
  BrickCost,
  BrickItem,
  Category,
  FinanceData,
  Income,
  ImportExecutionOptions,
  ImportExecutionResult,
  ImportPreview,
  MonthlyTarget,
  ScenarioConfig,
  Settings,
} from "@/types/finance";

const FALLBACK_SETTINGS: Settings = {
  minimum_cash_reserve: 500,
  currency: "BRL",
  default_scenario: "probable",
  alerts_enabled: true,
  stale_brick_days: 30,
  current_cash_balance: 0,
  bill_due_alert_days: 3,
  default_bill_priority: "medium",
  goals_affect_cashflow: true,
  goals_reduce_month_bills: true,
  default_goal_day: 25,
  show_goals_on_projection_charts: true,
};

const FALLBACK_DATA: FinanceData = {
  settings: FALLBACK_SETTINGS,
  categories: [],
  bills: [],
  incomes: [],
  monthly_targets: [],
  bricks: [],
  scenarios: [],
  audit_events: [],
};

interface FinanceStoreValue {
  currentCash: number;
  setCurrentCash: (value: number, reason?: string) => Promise<void>;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  categories: Category[];
  addCategory: (category: Omit<Category, "id">) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  bills: Bill[];
  addBill: (bill: Omit<Bill, "id" | "created_at" | "updated_at">) => Promise<void>;
  updateBill: (id: string, patch: Partial<Bill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  incomes: Income[];
  addIncome: (income: Omit<Income, "id" | "created_at" | "updated_at">) => Promise<void>;
  updateIncome: (id: string, patch: Partial<Income>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  monthlyTargets: MonthlyTarget[];
  addMonthlyTarget: (target: Omit<MonthlyTarget, "id" | "created_at" | "updated_at">) => Promise<void>;
  addMonthlyTargets: (targets: Array<Omit<MonthlyTarget, "id" | "created_at" | "updated_at">>) => Promise<void>;
  updateMonthlyTarget: (id: string, patch: Partial<MonthlyTarget>) => Promise<void>;
  completeMonthlyTarget: (id: string) => Promise<void>;
  reopenMonthlyTarget: (id: string) => Promise<void>;
  deleteMonthlyTarget: (id: string) => Promise<void>;
  bricks: BrickItem[];
  addBrick: (brick: Omit<BrickItem, "id" | "created_at" | "updated_at" | "costs">) => Promise<void>;
  updateBrick: (id: string, patch: Partial<BrickItem>) => Promise<void>;
  deleteBrick: (id: string) => Promise<void>;
  addBrickCost: (brickId: string, cost: Omit<BrickCost, "id" | "brick_item_id">) => Promise<void>;
  deleteBrickCost: (_brickId: string, costId: string) => Promise<void>;
  scenarios: ScenarioConfig[];
  updateScenario: (id: string, patch: Partial<Omit<ScenarioConfig, "id" | "name">>) => Promise<void>;
  auditEvents: AuditEvent[];
  importTemplate: (preview: ImportPreview, options: ImportExecutionOptions) => Promise<ImportExecutionResult>;
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const FinanceStoreContext = createContext<FinanceStoreValue | null>(null);

export function FinanceProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const queryKey = useMemo(() => ["finance-data", user?.id] as const, [user?.id]);

  const financeQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) {
        throw new Error("Sessao invalida.");
      }

      return fetchFinanceData(user.id);
    },
    enabled: Boolean(user),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const financeData = financeQuery.data ?? FALLBACK_DATA;

  const runMutation = useCallback(
    async <T,>(action: () => Promise<T>, successMessage?: string) => {
      if (!user) {
        throw new Error("Sessao invalida.");
      }

      setIsSyncing(true);
      try {
        const result = await action();
        await queryClient.invalidateQueries({ queryKey });
        if (successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (error) {
        const message = getFriendlyErrorMessage(error, "Nao foi possivel salvar a alteracao.");
        toast.error(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setIsSyncing(false);
      }
    },
    [queryClient, queryKey, user],
  );

  const value = useMemo<FinanceStoreValue>(
    () => ({
      currentCash: financeData.settings.current_cash_balance,
      async setCurrentCash(value, reason) {
        await runMutation(() => updateCurrentCash(user!.id, value, reason), "Caixa atualizado.");
      },
      settings: financeData.settings,
      async updateSettings(patch) {
        await runMutation(() => updateSettingsRecord(user!.id, patch), "Configuracoes atualizadas.");
      },
      categories: financeData.categories,
      async addCategory(category) {
        await runMutation(() => addCategoryRecord(user!.id, category), "Categoria criada.");
      },
      async deleteCategory(id) {
        await runMutation(() => deleteCategoryRecord(id), "Categoria removida.");
      },
      bills: financeData.bills,
      async addBill(bill) {
        await runMutation(() => addBillRecord(user!.id, bill), "Conta salva.");
      },
      async updateBill(id, patch) {
        await runMutation(() => updateBillRecord(id, patch), "Conta atualizada.");
      },
      async deleteBill(id) {
        await runMutation(() => deleteBillRecord(id), "Conta excluida.");
      },
      incomes: financeData.incomes,
      async addIncome(income) {
        await runMutation(() => addIncomeRecord(user!.id, income), "Entrada salva.");
      },
      async updateIncome(id, patch) {
        await runMutation(() => updateIncomeRecord(id, patch), "Entrada atualizada.");
      },
      async deleteIncome(id) {
        await runMutation(() => deleteIncomeRecord(id), "Entrada excluida.");
      },
      monthlyTargets: financeData.monthly_targets,
      async addMonthlyTarget(target) {
        await runMutation(() => addMonthlyTargetRecord(user!.id, target), "Meta mensal criada.");
      },
      async addMonthlyTargets(targets) {
        await runMutation(() => addMonthlyTargetsRecord(user!.id, targets), `${targets.length} meta(s) mensal(is) criada(s).`);
      },
      async updateMonthlyTarget(id, patch) {
        await runMutation(() => updateMonthlyTargetRecord(id, patch), "Meta mensal atualizada.");
      },
      async completeMonthlyTarget(id) {
        await runMutation(() => completeMonthlyTargetRecord(id), "Meta marcada como batida.");
      },
      async reopenMonthlyTarget(id) {
        await runMutation(() => reopenMonthlyTargetRecord(id), "Meta reaberta.");
      },
      async deleteMonthlyTarget(id) {
        await runMutation(() => deleteMonthlyTargetRecord(id), "Meta mensal removida.");
      },
      bricks: financeData.bricks,
      async addBrick(brick) {
        await runMutation(() => addBrickRecord(user!.id, brick), "Brick salvo.");
      },
      async updateBrick(id, patch) {
        await runMutation(() => updateBrickRecord(id, patch), "Brick atualizado.");
      },
      async deleteBrick(id) {
        await runMutation(() => deleteBrickRecord(id), "Brick excluido.");
      },
      async addBrickCost(brickId, cost) {
        await runMutation(() => addBrickCostRecord(brickId, cost), "Custo adicionado.");
      },
      async deleteBrickCost(_brickId, costId) {
        await runMutation(() => deleteBrickCostRecord(costId), "Custo removido.");
      },
      scenarios: financeData.scenarios,
      async updateScenario(id, patch) {
        await runMutation(() => updateScenarioConfigRecord(id, patch), "Cenario atualizado.");
      },
      auditEvents: financeData.audit_events,
      async importTemplate(preview, options) {
        return runMutation(
          () => executeTemplateImport(user!.id, preview, options),
          "Importacao concluida.",
        );
      },
      isLoading: financeQuery.isLoading,
      isSyncing,
      error:
        financeQuery.error instanceof Error
          ? new Error(getFriendlyErrorMessage(financeQuery.error, "Nao foi possivel carregar os dados."))
          : null,
      async refresh() {
        await queryClient.invalidateQueries({ queryKey });
      },
    }),
    [financeData, financeQuery.error, financeQuery.isLoading, isSyncing, queryClient, queryKey, runMutation, user],
  );

  return <FinanceStoreContext.Provider value={value}>{children}</FinanceStoreContext.Provider>;
}

export function useFinanceStore() {
  const context = useContext(FinanceStoreContext);

  if (!context) {
    throw new Error("useFinanceStore precisa ser usado dentro de FinanceProvider.");
  }

  return context;
}
