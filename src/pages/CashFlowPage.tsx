import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcDailyProjections, formatCurrency } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { ScenarioType } from "@/types/finance";

export default function CashFlowPage() {
  const { currentCash, bills, incomes, bricks, monthlyTargets, settings, scenarios } = useFinanceStore();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>(settings.default_scenario);
  const [days, setDays] = useState(30);
  const [onlyRisk, setOnlyRisk] = useState(false);

  const projections = useMemo(
    () => calcDailyProjections(currentCash, bills, incomes, bricks, settings, days, scenarios, selectedScenario, undefined, monthlyTargets),
    [currentCash, bills, incomes, bricks, monthlyTargets, settings, days, scenarios, selectedScenario],
  );

  const filtered = onlyRisk ? projections.filter((day) => day.needs_sale || day.risk_level !== "safe") : projections;
  const totalShortfall = filtered.reduce((sum, day) => sum + day.shortfall, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Fluxo de caixa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Timeline diaria com saldo inicial, entradas, saidas, risco e observacoes automaticas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["conservative", "probable", "optimistic"] as ScenarioType[]).map((scenario) => (
            <Button
              key={scenario}
              size="sm"
              variant={selectedScenario === scenario ? "default" : "outline"}
              onClick={() => setSelectedScenario(scenario)}
            >
              {scenario === "conservative" ? "Conservador" : scenario === "probable" ? "Provavel" : "Otimista"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dias exibidos</p>
            <div className="mt-3 flex gap-2">
              {[15, 30, 60].map((value) => (
                <Button key={value} size="sm" variant={days === value ? "default" : "outline"} onClick={() => setDays(value)}>
                  {value}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dias em risco</p>
            <p className="mt-2 text-xl font-semibold text-warning-custom">
              {projections.filter((day) => day.risk_level !== "safe").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Maior falta acumulada</p>
            <p className="mt-2 text-xl font-semibold text-negative">{formatCurrency(totalShortfall, settings.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Filtro</p>
            <Button className="mt-3 w-full" variant={onlyRisk ? "default" : "outline"} onClick={() => setOnlyRisk((current) => !current)}>
              {onlyRisk ? "Mostrando so risco" : "Mostrar so risco"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Linha do tempo financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Saldo inicial</TableHead>
                <TableHead>Entradas previstas</TableHead>
                <TableHead>Entradas confirmadas</TableHead>
                <TableHead>Saidas previstas</TableHead>
                <TableHead>Saidas confirmadas</TableHead>
                <TableHead>Comprometido</TableHead>
                <TableHead>Caixa livre</TableHead>
                <TableHead>Saldo final</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Observacoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((day) => (
                <TableRow key={day.date} className={day.negative ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{day.date}</TableCell>
                  <TableCell>{formatCurrency(day.opening_balance, settings.currency)}</TableCell>
                  <TableCell className="text-positive">
                    {formatCurrency(day.total_expected_inflows, settings.currency)}
                  </TableCell>
                  <TableCell className="text-positive">
                    {formatCurrency(day.total_confirmed_inflows, settings.currency)}
                  </TableCell>
                  <TableCell className="text-negative">
                    {formatCurrency(day.total_expected_outflows, settings.currency)}
                  </TableCell>
                  <TableCell className="text-negative">
                    {formatCurrency(day.total_confirmed_outflows, settings.currency)}
                  </TableCell>
                  <TableCell>{formatCurrency(day.committed_cash, settings.currency)}</TableCell>
                  <TableCell
                    className={
                      day.free_cash_after_commitments < 0 ? "text-negative font-medium" : "text-muted-foreground"
                    }
                  >
                    {formatCurrency(day.free_cash_after_commitments, settings.currency)}
                  </TableCell>
                  <TableCell className={day.closing_balance < 0 ? "text-negative font-semibold" : "font-semibold"}>
                    {formatCurrency(day.closing_balance, settings.currency)}
                  </TableCell>
                  <TableCell>
                    {day.negative && <Badge variant="destructive">Negativo</Badge>}
                    {!day.negative && day.below_reserve && <Badge variant="outline">Reserva</Badge>}
                    {!day.negative && !day.below_reserve && <Badge variant="secondary">Seguro</Badge>}
                  </TableCell>
                  <TableCell className="max-w-sm text-xs text-muted-foreground">
                    <div className="space-y-1">
                      {day.notes.map((note) => (
                        <p key={`${day.date}-${note}`}>{note}</p>
                      ))}
                      {day.needs_sale && (
                        <p className="font-medium text-foreground">
                          Precisa levantar {formatCurrency(day.shortfall, settings.currency)}.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                    Nenhum dia corresponde ao filtro atual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
