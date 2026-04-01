import { useFinanceStore } from '@/stores/financeStore';
import { calcCashSummary, calcDailyProjections, formatCurrency, generateAlerts, suggestSales, calcBrickMetrics } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, 
  Box, Receipt, ArrowDownCircle, Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useMemo } from 'react';

function MetricCard({ title, value, icon: Icon, variant = 'default' }: {
  title: string; value: string; icon: React.ElementType; variant?: 'default' | 'positive' | 'negative' | 'warning';
}) {
  const colors = {
    default: 'text-foreground',
    positive: 'text-positive',
    negative: 'text-negative',
    warning: 'text-warning-custom',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{title}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${colors[variant]}`}>{value}</p>
          </div>
          <Icon className={`h-5 w-5 ${colors[variant]} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { currentCash, bills, incomes, bricks, settings, loadSeedData } = useFinanceStore();

  const summary = useMemo(() => calcCashSummary(currentCash, bills, incomes, bricks, settings), [currentCash, bills, incomes, bricks, settings]);
  const projections = useMemo(() => calcDailyProjections(currentCash, bills, incomes, settings, 30), [currentCash, bills, incomes, settings]);
  const alerts = useMemo(() => generateAlerts(bills, bricks, projections, settings), [bills, bricks, projections, settings]);
  const salesSuggestions = useMemo(() => summary.sale_needed > 0 ? suggestSales(bricks, summary.sale_needed) : [], [bricks, summary.sale_needed]);

  const chartData = projections.slice(0, 15).map(p => ({
    date: p.date.slice(5),
    saldo: p.closing_balance,
    entradas: p.expected_income + p.confirmed_income,
    saídas: p.expected_expenses,
  }));

  const isEmpty = bills.length === 0 && incomes.length === 0 && bricks.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono">Visão consolidada do seu caixa</p>
        </div>
        {isEmpty && (
          <Button onClick={loadSeedData} variant="outline" size="sm">
            Carregar dados de exemplo
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Caixa Disponível" value={formatCurrency(summary.available_cash)} icon={DollarSign} variant={summary.available_cash > 0 ? 'positive' : 'negative'} />
        <MetricCard title="Projeção 7d" value={formatCurrency(summary.projected_cash_7d)} icon={TrendingUp} variant={summary.projected_cash_7d > 0 ? 'default' : 'negative'} />
        <MetricCard title="Contas Pendentes" value={formatCurrency(summary.total_pending_bills)} icon={Receipt} variant="warning" />
        <MetricCard title="Entradas Previstas" value={formatCurrency(summary.total_expected_income)} icon={ArrowDownCircle} variant="positive" />
        <MetricCard title="Capital em Bricks" value={formatCurrency(summary.locked_in_bricks)} icon={Box} />
        <MetricCard title="Lucro do Mês" value={formatCurrency(summary.month_profit)} icon={TrendingUp} variant={summary.month_profit >= 0 ? 'positive' : 'negative'} />
        <MetricCard title="Projeção 15d" value={formatCurrency(summary.projected_cash_15d)} icon={Calendar} variant={summary.projected_cash_15d > 0 ? 'default' : 'negative'} />
        <MetricCard title="Projeção 30d" value={formatCurrency(summary.projected_cash_30d)} icon={Calendar} variant={summary.projected_cash_30d > 0 ? 'default' : 'negative'} />
      </div>

      {/* Critical Info */}
      {summary.day_goes_negative && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-negative" />
            <div>
              <p className="font-sans font-semibold text-negative">⚠️ Caixa ficará negativo em {summary.day_goes_negative}</p>
              <p className="text-sm text-muted-foreground">Necessário levantar {formatCurrency(summary.sale_needed)} para cobrir</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Balance Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Projeção de Saldo (15 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Income vs Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Entradas vs Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="entradas" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="saídas" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Alertas ({alerts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta</p>}
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted">
                <Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'warning' ? 'outline' : 'secondary'} className="text-xs shrink-0 mt-0.5">
                  {a.severity}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sale Suggestions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Sugestão de Venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {salesSuggestions.length === 0 && <p className="text-sm text-muted-foreground">Sem necessidade de venda urgente</p>}
            {salesSuggestions.map(b => {
              const m = calcBrickMetrics(b);
              return (
                <div key={b.id} className="flex items-center justify-between p-2 rounded bg-muted">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">Provável: {formatCurrency(b.probable_sale_price)} · Lucro: {formatCurrency(m.net_profit)}</p>
                  </div>
                  <Badge className="text-xs">{b.liquidity}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
