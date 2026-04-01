import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { calcDailyProjections, formatCurrency } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CashFlowPage() {
  const { currentCash, bills, incomes, settings } = useFinanceStore();
  const projections = useMemo(
    () => calcDailyProjections(currentCash, bills, incomes, settings, 30),
    [currentCash, bills, incomes, settings]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sans font-bold">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground font-mono">Projeção diária — próximos 30 dias</p>
      </div>

      <div className="space-y-1">
        {projections.map(day => (
          <Card key={day.date} className={day.negative ? 'border-destructive' : day.below_reserve ? 'border-warning' : ''}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-muted-foreground w-24">{day.date}</span>
                  <div className="flex items-center gap-3 text-xs">
                    {day.expected_income > 0 && (
                      <span className="text-positive font-mono">+{formatCurrency(day.expected_income)}</span>
                    )}
                    {day.confirmed_income > 0 && (
                      <span className="text-positive font-mono font-bold">✓+{formatCurrency(day.confirmed_income)}</span>
                    )}
                    {day.expected_expenses > 0 && (
                      <span className="text-negative font-mono">-{formatCurrency(day.expected_expenses)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {day.negative && <Badge variant="destructive" className="text-xs">NEGATIVO</Badge>}
                  {day.below_reserve && !day.negative && <Badge variant="outline" className="text-xs text-warning-custom">Abaixo reserva</Badge>}
                  {day.needs_sale && <Badge variant="outline" className="text-xs">Vender: {formatCurrency(day.shortfall)}</Badge>}
                  <span className={`font-mono text-sm font-semibold min-w-[100px] text-right ${
                    day.closing_balance < 0 ? 'text-negative' : day.below_reserve ? 'text-warning-custom' : 'text-positive'
                  }`}>
                    {formatCurrency(day.closing_balance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
