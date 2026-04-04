import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildReportSnapshot, formatCurrency } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { ScenarioType } from "@/types/finance";

const COLORS = [
  "hsl(142, 70%, 45%)",
  "hsl(217, 70%, 50%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(190, 70%, 50%)",
];

export default function ReportsPage() {
  const { currentCash, bills, incomes, bricks, monthlyTargets, categories, settings, scenarios } = useFinanceStore();
  const [months, setMonths] = useState(6);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>(settings.default_scenario);

  const report = useMemo(
    () =>
      buildReportSnapshot(
        currentCash,
        bills,
        incomes,
        bricks,
        categories,
        settings,
        scenarios,
        selectedScenario,
        months,
        monthlyTargets,
      ),
    [currentCash, bills, incomes, bricks, monthlyTargets, categories, settings, scenarios, selectedScenario, months],
  );

  const realizedProfit = report.top_profit_bricks.reduce((sum, row) => sum + row.metrics.net_profit, 0);
  const lockedCapital = report.capital_evolution[report.capital_evolution.length - 1]?.value ?? 0;
  const freeCashNow = report.free_cash_evolution[report.free_cash_evolution.length - 1]?.value ?? 0;
  const latestMonth = report.monthly_flow[report.monthly_flow.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Relatorios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fluxo mensal, previsto vs realizado, lucratividade e giro de capital.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(months)} onValueChange={(value) => setMonths(Number(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedScenario} onValueChange={(value) => setSelectedScenario(value as ScenarioType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservador</SelectItem>
              <SelectItem value="probable">Provavel</SelectItem>
              <SelectItem value="optimistic">Otimista</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Lucro realizado</p>
            <p className="mt-2 text-xl font-semibold text-positive">{formatCurrency(realizedProfit, settings.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Capital travado</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(lockedCapital, settings.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Caixa livre projetado</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(freeCashNow, settings.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Giro de capital</p>
            <p className="mt-2 text-xl font-semibold">{report.turnover_ratio.toFixed(2)}x</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Melhor categoria: {report.best_category ?? "Sem dados"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Metas de entrada</p>
            <p className="mt-2 text-xl font-semibold text-positive">
              {formatCurrency(latestMonth?.goal_income ?? 0, settings.currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Metas mensais previstas para o ultimo mes da leitura.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Contas liquidas</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCurrency(latestMonth?.net_expenses_after_goals ?? 0, settings.currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contas do mes menos metas marcadas para abater gastos.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Fluxo mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={report.monthly_flow}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                <Bar dataKey="confirmed_income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="confirmed_expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="locked_capital" stroke="hsl(var(--primary))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Previsto vs realizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={report.income_planned_vs_actual}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                <Bar dataKey="planned" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Metas vs contas do mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={report.monthly_flow}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                <Bar dataKey="expected_expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net_expenses_after_goals" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="goal_income" stroke="hsl(var(--success))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Lucro por categoria de brick
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.profitability_by_category.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas suficientes para comparar categorias.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={report.profitability_by_category}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    label={({ name, value }) => `${name}: ${formatCurrency(value, settings.currency)}`}
                  >
                    {report.profitability_by_category.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Evolucao do caixa livre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={report.free_cash_evolution}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Itens mais lucrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.top_profit_bricks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum brick vendido ainda.</p>}
            {report.top_profit_bricks.map((row) => (
              <div key={row.brick.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                <div>
                  <p className="font-medium">{row.brick.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ROI {row.metrics.roi_percent.toFixed(1)}% · {row.metrics.days_locked} dias · score de liquidez {row.liquidity_score.toFixed(0)}
                  </p>
                </div>
                <span className={row.metrics.net_profit >= 0 ? "font-semibold text-positive" : "font-semibold text-negative"}>
                  {formatCurrency(row.metrics.net_profit, settings.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Itens mais rapidos de vender</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.fastest_bricks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum brick vendido ainda.</p>}
            {report.fastest_bricks.map((row) => (
              <div key={row.brick.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                <div>
                  <p className="font-medium">{row.brick.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.metrics.days_locked} dias · lucro por dia {formatCurrency(row.metrics.profit_per_day, settings.currency)}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(row.metrics.net_profit, settings.currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
