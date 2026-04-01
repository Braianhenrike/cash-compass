import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { formatCurrency, calcBrickMetrics, calcLockedCapital } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(142, 70%, 45%)', 'hsl(217, 70%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)'];

export default function ReportsPage() {
  const { bills, incomes, bricks, categories } = useFinanceStore();

  const billsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    bills.forEach(b => {
      const cat = categories.find(c => c.id === b.category_id)?.name || 'Sem categoria';
      map[cat] = (map[cat] || 0) + b.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [bills, categories]);

  const soldBricks = useMemo(() => 
    bricks.filter(b => b.status === 'sold').map(b => ({
      name: b.name,
      ...calcBrickMetrics(b),
    })).sort((a, b) => b.net_profit - a.net_profit),
  [bricks]);

  const profitByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    bricks.filter(b => b.status === 'sold').forEach(b => {
      const cat = categories.find(c => c.id === b.category_id)?.name || 'Sem categoria';
      map[cat] = (map[cat] || 0) + calcBrickMetrics(b).net_profit;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [bricks, categories]);

  const monthlyIncome = useMemo(() => {
    const received = incomes.filter(i => i.status === 'received');
    return received.reduce((s, i) => s + i.amount, 0);
  }, [incomes]);

  const monthlyExpense = useMemo(() => {
    return bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
  }, [bills]);

  const locked = calcLockedCapital(bricks);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sans font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground font-mono">Análise de performance financeira</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-mono">Receita Confirmada</p>
            <p className="text-xl font-bold font-mono text-positive">{formatCurrency(monthlyIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-mono">Despesas Pagas</p>
            <p className="text-xl font-bold font-mono text-negative">{formatCurrency(monthlyExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-mono">Capital Travado</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(locked)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-mono">Lucro Bricks</p>
            <p className="text-xl font-bold font-mono text-positive">{formatCurrency(soldBricks.reduce((s, b) => s + b.net_profit, 0))}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Bills by category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Contas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={billsByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                  {billsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit by brick */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Lucro por Brick Vendido</CardTitle>
          </CardHeader>
          <CardContent>
            {soldBricks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum brick vendido</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={soldBricks}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="net_profit" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Profit by category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Lucro por Categoria de Brick</CardTitle>
          </CardHeader>
          <CardContent>
            {profitByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={profitByCategory}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Brick performance table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Performance de Bricks Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {soldBricks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-2 text-xs">
                {soldBricks.map((b, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                    <span className="font-medium">{b.name}</span>
                    <div className="flex gap-4 font-mono">
                      <span className={b.net_profit >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(b.net_profit)}</span>
                      <span>{b.roi_percent.toFixed(1)}% ROI</span>
                      <span>{b.days_locked}d</span>
                      <span>{formatCurrency(b.profit_per_day)}/d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
