import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useFinanceStore } from "@/stores/financeStore";
import type {
  CategoryType,
  ScenarioConfig,
  ScenarioType,
  Settings,
} from "@/types/finance";

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
    categories,
    addCategory,
    deleteCategory,
    scenarios,
    updateScenario,
    monthlyTargets,
    isSyncing,
  } = useFinanceStore();
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [scenarioDrafts, setScenarioDrafts] = useState<Record<string, ScenarioConfig>>({});
  const [newCategory, setNewCategory] = useState<{ type: CategoryType; name: string }>({ type: "bill", name: "" });

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    setScenarioDrafts(
      Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario])),
    );
  }, [scenarios]);

  const hasSettingsChanges = useMemo(
    () => JSON.stringify(settingsDraft) !== JSON.stringify(settings),
    [settingsDraft, settings],
  );
  const monthlyTargetsSummary = useMemo(() => {
    const active = monthlyTargets.filter((target) => target.is_active);
    const completed = active.filter((target) => target.status === "completed");
    const pending = active.filter((target) => target.status !== "completed");

    return {
      activeCount: active.length,
      completedCount: completed.length,
      pendingCount: pending.length,
    };
  }, [monthlyTargets]);

  async function handleAddCategory() {
    if (!newCategory.name.trim()) {
      return;
    }

    await addCategory({
      type: newCategory.type,
      name: newCategory.name.trim(),
    });
    setNewCategory((current) => ({ ...current, name: "" }));
  }

  async function saveSettings() {
    await updateSettings(settingsDraft as Partial<Settings>);
  }

  async function saveScenario(id: string) {
    const scenario = scenarioDrafts[id];
    if (!scenario) {
      return;
    }

    await updateScenario(id, {
      sale_price_multiplier: scenario.sale_price_multiplier,
      sale_delay_days: scenario.sale_delay_days,
      expected_income_multiplier: scenario.expected_income_multiplier,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Configuracoes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reserva minima, metas mensais, parametros do usuario, categorias e cenarios.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Caixa e planejamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Valor em maos hoje</Label>
              <Input
                className="mt-2"
                type="number"
                value={settingsDraft.current_cash_balance}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    current_cash_balance: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reserva minima de caixa</Label>
              <Input
                className="mt-2"
                type="number"
                value={settingsDraft.minimum_cash_reserve}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    minimum_cash_reserve: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Dias para alertar conta vencendo</Label>
                <Input
                  className="mt-2"
                  type="number"
                  value={settingsDraft.bill_due_alert_days}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      bill_due_alert_days: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dias para brick parado</Label>
                <Input
                  className="mt-2"
                  type="number"
                  value={settingsDraft.stale_brick_days}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      stale_brick_days: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Moeda</Label>
                <Select
                  value={settingsDraft.currency}
                  onValueChange={(value) => setSettingsDraft((current) => ({ ...current, currency: value }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prioridade padrao</Label>
                <Select
                  value={settingsDraft.default_bill_priority}
                  onValueChange={(value) =>
                    setSettingsDraft((current) => ({ ...current, default_bill_priority: value as Settings["default_bill_priority"] }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Critica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Cenario padrao</Label>
                <Select
                  value={settingsDraft.default_scenario}
                  onValueChange={(value) =>
                    setSettingsDraft((current) => ({ ...current, default_scenario: value as ScenarioType }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservador</SelectItem>
                    <SelectItem value="probable">Provavel</SelectItem>
                    <SelectItem value="optimistic">Otimista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dia padrao da meta mensal</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={1}
                  max={28}
                  value={settingsDraft.default_goal_day}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      default_goal_day: clampDay(Number(event.target.value) || 1),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Metas entram no fluxo</p>
                  <p className="text-xs text-muted-foreground">Meta de side hustle vira previsao de entrada.</p>
                </div>
                <Switch
                  checked={settingsDraft.goals_affect_cashflow}
                  onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, goals_affect_cashflow: value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Metas abatem contas do mes</p>
                  <p className="text-xs text-muted-foreground">Serve para leitura liquida dos gastos do mes.</p>
                </div>
                <Switch
                  checked={settingsDraft.goals_reduce_month_bills}
                  onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, goals_reduce_month_bills: value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Mostrar metas nos graficos</p>
                <p className="text-xs text-muted-foreground">Exibe a linha de metas na simulacao e no monitoramento do dashboard.</p>
              </div>
              <Switch
                checked={settingsDraft.show_goals_on_projection_charts}
                onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, show_goals_on_projection_charts: value }))}
              />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Alertas ativos</p>
                  <p className="text-xs text-muted-foreground">Caixa, contas e bricks parados.</p>
                </div>
                <Switch
                  checked={settingsDraft.alerts_enabled}
                  onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, alerts_enabled: value }))}
                />
              </div>
            </div>
            <Button onClick={() => void saveSettings()} disabled={!hasSettingsChanges || isSyncing}>
              Salvar configuracoes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["bill", "income", "brick"] as const).map((type) => (
              <div key={type}>
                <p className="mb-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {type === "bill" ? "Contas" : type === "income" ? "Entradas" : "Bricks"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((category) => category.type === type)
                    .map((category) => (
                      <Badge key={category.id} variant="secondary" className="gap-2">
                        {category.name}
                        <button onClick={() => void deleteCategory(category.id)} className="text-xs text-muted-foreground">
                          x
                        </button>
                      </Badge>
                    ))}
                </div>
              </div>
            ))}

            <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
              <Select
                value={newCategory.type}
                onValueChange={(value) => setNewCategory((current) => ({ ...current, type: value as CategoryType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bill">Conta</SelectItem>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="brick">Brick</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Nome da categoria"
                value={newCategory.name}
                onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
              />
              <Button size="sm" onClick={() => void handleAddCategory()} disabled={isSyncing}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Metas mensais</CardTitle>
          <p className="text-sm text-muted-foreground">
            A operacao de metas agora tem pagina propria, com filtros, cards, batida/desfazer e ocorrencias separadas por dia.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ativas</p>
              <p className="mt-2 text-2xl font-semibold">{monthlyTargetsSummary.activeCount}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Pendentes</p>
              <p className="mt-2 text-2xl font-semibold">{monthlyTargetsSummary.pendingCount}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Batidas</p>
              <p className="mt-2 text-2xl font-semibold">{monthlyTargetsSummary.completedCount}</p>
            </div>
          </div>

          <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Use a pagina de metas para criar metas recorrentes por dia da semana, marcar quando bater e acompanhar a diferenca entre leitura real e otimista.
          </div>

          <Button asChild>
            <Link to="/targets">Abrir pagina de metas</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Parametros dos cenarios</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {scenarios.map((scenario) => {
            const current = scenarioDrafts[scenario.id] ?? scenario;
            return (
              <div key={scenario.id} className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">
                  {scenario.name === "conservative"
                    ? "Conservador"
                    : scenario.name === "probable"
                      ? "Provavel"
                      : "Otimista"}
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Multiplicador do preco de venda</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.01"
                      value={current.sale_price_multiplier}
                      onChange={(event) =>
                        setScenarioDrafts((drafts) => ({
                          ...drafts,
                          [scenario.id]: {
                            ...current,
                            sale_price_multiplier: Number(event.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Atraso da venda em dias</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      value={current.sale_delay_days}
                      onChange={(event) =>
                        setScenarioDrafts((drafts) => ({
                          ...drafts,
                          [scenario.id]: {
                            ...current,
                            sale_delay_days: Number(event.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Multiplicador das entradas futuras</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.01"
                      value={current.expected_income_multiplier}
                      onChange={(event) =>
                        setScenarioDrafts((drafts) => ({
                          ...drafts,
                          [scenario.id]: {
                            ...current,
                            expected_income_multiplier: Number(event.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void saveScenario(scenario.id)} disabled={isSyncing}>
                    Salvar cenario
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Dados e setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O projeto continua preparado para Supabase local + Vercel. As metas mensais servem para leitura gerencial do mes e tambem podem entrar no fluxo quando voce marcar isso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
