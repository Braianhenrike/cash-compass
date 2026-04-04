import { useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, Filter, Target } from "lucide-react";
import { format } from "date-fns";

import MonthlyTargetsManager, { targetTypeLabels } from "@/components/targets/MonthlyTargetsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { MonthlyTarget, MonthlyTargetType } from "@/types/finance";

type StatusFilter = "all" | "pending" | "completed";
type TypeFilter = "all" | MonthlyTargetType;

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-2xl bg-muted p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TargetsPage() {
  const { monthlyTargets, settings } = useFinanceStore();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const filteredTargets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return monthlyTargets.filter((target) => {
      const matchesMonth = !monthFilter || target.month_ref.startsWith(monthFilter);
      const matchesStatus = statusFilter === "all" || target.status === statusFilter;
      const matchesType = typeFilter === "all" || target.type === typeFilter;
      const matchesSearch =
        query === "" ||
        target.title.toLowerCase().includes(query) ||
        (target.notes ?? "").toLowerCase().includes(query) ||
        (target.expected_date ?? "").includes(query);

      return matchesMonth && matchesStatus && matchesType && matchesSearch;
    });
  }, [monthFilter, monthlyTargets, search, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    const active = filteredTargets.filter((target) => target.is_active);
    const completed = active.filter((target) => target.status === "completed");
    const pending = active.filter((target) => target.status !== "completed");
    const cashflowPotential = pending
      .filter((target) => (target.type === "side_hustle_goal" || target.type === "extra_income_goal") && target.applies_to_cashflow)
      .reduce((sum, target) => sum + target.amount, 0);

    return {
      activeCount: active.length,
      completedValue: completed.reduce((sum, target) => sum + target.amount, 0),
      pendingValue: pending.reduce((sum, target) => sum + target.amount, 0),
      cashflowPotential,
    };
  }, [filteredTargets]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Metas</h1>
        <p className="text-sm text-muted-foreground">
          Centro de operacao das metas. Aqui cada ocorrencia aparece separada, voce marca quando bateu e acompanha o
          que entra no real versus o que ainda e so projetado.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <SummaryCard
          title="Ocorrencias ativas"
          value={String(summary.activeCount)}
          description="Quantidade de metas ativas dentro do filtro atual."
          icon={Target}
        />
        <SummaryCard
          title="Valor pendente"
          value={formatCurrency(summary.pendingValue, settings.currency)}
          description="Quanto ainda falta bater no filtro atual."
          icon={Clock3}
        />
        <SummaryCard
          title="Valor batido"
          value={formatCurrency(summary.completedValue, settings.currency)}
          description="Quanto ja virou realidade nas metas filtradas."
          icon={CheckCircle2}
        />
        <SummaryCard
          title="Pode entrar no caixa"
          value={formatCurrency(summary.cashflowPotential, settings.currency)}
          description="Potencial das metas pendentes que entram no fluxo."
          icon={CircleDollarSign}
        />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros da leitura
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Filtre por mes, status, tipo e texto para focar so no bloco de metas que voce quer operar agora.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label className="text-xs text-muted-foreground">Mes</Label>
            <Input className="mt-2" type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="completed">Batidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(targetTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Busca</Label>
            <Input
              className="mt-2"
              placeholder="Titulo, observacao ou data"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <MonthlyTargetsManager
        targets={filteredTargets}
        title="Ocorrencias de metas"
        description="Cada linha abaixo ja e uma ocorrencia operacional. As recorrentes foram quebradas por dia e voce pode bater ou reabrir direto daqui."
        emptyMessage="Nenhuma meta encontrada com os filtros atuais."
      />
    </div>
  );
}
