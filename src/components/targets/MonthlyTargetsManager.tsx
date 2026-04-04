import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMonthlyTargetPersistedTitle,
  materializeMonthlyTargetDraft,
  stripMonthlyTargetPersistedTitle,
} from "@/lib/monthlyTargets";
import { useFinanceStore } from "@/stores/financeStore";
import type { MonthlyTarget, MonthlyTargetType, Settings } from "@/types/finance";

export const targetTypeLabels: Record<MonthlyTargetType, string> = {
  side_hustle_goal: "Meta de side hustle",
  extra_income_goal: "Meta de entrada extra",
  expense_cap: "Teto de gastos",
  reinvestment_cap: "Limite de reinvestimento",
  reserve_goal: "Meta de reserva",
};

const weekdayLabels = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

function clampDay(day: number) {
  return Math.min(28, Math.max(1, day || 1));
}

function buildExpectedDate(monthValue: string, day: number) {
  if (!monthValue) {
    return "";
  }

  return `${monthValue}-${String(clampDay(day)).padStart(2, "0")}`;
}

function buildTargetDraft(settings: Settings, monthValue = new Date().toISOString().slice(0, 7)) {
  return {
    month_ref: monthValue,
    title: "",
    type: "side_hustle_goal" as MonthlyTargetType,
    amount: "",
    expected_date: buildExpectedDate(monthValue, settings.default_goal_day),
    applies_to_cashflow: settings.goals_affect_cashflow,
    offsets_monthly_bills: settings.goals_reduce_month_bills,
    is_active: true,
    recurrence_mode: "single" as const,
    recurrence_weekdays: [] as number[],
    recurrence_occurrences: "",
    notes: "",
  };
}

function describeTargetRecurrence(target: MonthlyTarget) {
  if (target.recurrence_mode !== "weekly" || target.recurrence_weekdays.length === 0) {
    return target.expected_date ? `Data prevista em ${target.expected_date}` : "Meta pontual no mes";
  }

  const labels = weekdayLabels
    .filter((weekday) => target.recurrence_weekdays.includes(weekday.value))
    .map((weekday) => weekday.label)
    .join(", ");

  return target.recurrence_occurrences
    ? `Recorrente em ${labels} (${target.recurrence_occurrences}x no mes)`
    : `Recorrente em ${labels} por todo o mes`;
}

type DraftShape = ReturnType<typeof buildTargetDraft>;

interface MonthlyTargetsManagerProps {
  title?: string;
  description?: string;
  emptyMessage?: string;
  targets?: MonthlyTarget[];
  settingsDefaults?: Settings;
}

export default function MonthlyTargetsManager({
  title = "Metas mensais e parametros",
  description = "Aqui entram metas previstas por mes, como side hustle, limite de reinvestimento, teto de gastos e meta de reserva.",
  emptyMessage = "Nenhuma meta mensal criada ainda.",
  targets,
  settingsDefaults,
}: MonthlyTargetsManagerProps) {
  const {
    settings,
    monthlyTargets,
    addMonthlyTarget,
    addMonthlyTargets,
    updateMonthlyTarget,
    completeMonthlyTarget,
    reopenMonthlyTarget,
    deleteMonthlyTarget,
    isSyncing,
  } = useFinanceStore();

  const effectiveSettings = settingsDefaults ?? settings;
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [targetDraft, setTargetDraft] = useState<DraftShape>(() => buildTargetDraft(effectiveSettings));

  useEffect(() => {
    if (!editingTargetId) {
      setTargetDraft((current) => ({
        ...current,
        applies_to_cashflow: effectiveSettings.goals_affect_cashflow,
        offsets_monthly_bills: effectiveSettings.goals_reduce_month_bills,
        expected_date:
          current.expected_date ||
          buildExpectedDate(current.month_ref || new Date().toISOString().slice(0, 7), effectiveSettings.default_goal_day),
      }));
    }
  }, [
    editingTargetId,
    effectiveSettings.default_goal_day,
    effectiveSettings.goals_affect_cashflow,
    effectiveSettings.goals_reduce_month_bills,
  ]);

  const visibleTargets = useMemo(
    () => [...(targets ?? monthlyTargets)].sort((left, right) => {
      const dateCompare = (left.expected_date ?? left.month_ref).localeCompare(right.expected_date ?? right.month_ref);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return left.title.localeCompare(right.title);
    }),
    [monthlyTargets, targets],
  );

  function resetTargetForm(monthValue = new Date().toISOString().slice(0, 7)) {
    setEditingTargetId(null);
    setTargetDraft(buildTargetDraft(effectiveSettings, monthValue));
  }

  function openNewTargetDialog(monthValue = new Date().toISOString().slice(0, 7)) {
    resetTargetForm(monthValue);
    setIsTargetDialogOpen(true);
  }

  function openTargetForEdit(target: MonthlyTarget) {
    setEditingTargetId(target.id);
    setTargetDraft({
      month_ref: target.month_ref.slice(0, 7),
      title: stripMonthlyTargetPersistedTitle(target.title),
      type: target.type,
      amount: String(target.amount),
      expected_date: target.expected_date ?? "",
      applies_to_cashflow: target.applies_to_cashflow,
      offsets_monthly_bills: target.offsets_monthly_bills,
      is_active: target.is_active,
      recurrence_mode: target.recurrence_mode,
      recurrence_weekdays: target.recurrence_weekdays,
      recurrence_occurrences: target.recurrence_occurrences ? String(target.recurrence_occurrences) : "",
      notes: target.notes,
    });
    setIsTargetDialogOpen(true);
  }

  async function saveMonthlyTarget() {
    if (!targetDraft.title.trim() || !targetDraft.amount || !targetDraft.month_ref) {
      return;
    }

    const payload = {
      month_ref: `${targetDraft.month_ref}-01`,
      title: formatMonthlyTargetPersistedTitle(targetDraft.title.trim(), targetDraft.expected_date || null),
      type: targetDraft.type,
      amount: Number(targetDraft.amount) || 0,
      expected_date: targetDraft.expected_date || null,
      applies_to_cashflow: targetDraft.applies_to_cashflow,
      offsets_monthly_bills: targetDraft.offsets_monthly_bills,
      is_active: targetDraft.is_active,
      recurrence_mode: targetDraft.recurrence_mode,
      recurrence_weekdays: targetDraft.recurrence_weekdays,
      recurrence_occurrences: targetDraft.recurrence_occurrences ? Number(targetDraft.recurrence_occurrences) : null,
      notes: targetDraft.notes.trim(),
      status: "pending" as const,
      completed_at: null,
    };

    if (editingTargetId) {
      await updateMonthlyTarget(editingTargetId, payload);
    } else {
      const materializedTargets = materializeMonthlyTargetDraft(targetDraft, effectiveSettings, new Date());

      if (materializedTargets.length === 0) {
        toast.error("Nao encontrei ocorrencias futuras para essa meta dentro do mes escolhido.");
        return;
      }

      if (materializedTargets.length === 1) {
        await addMonthlyTarget(materializedTargets[0]);
      } else {
        await addMonthlyTargets(materializedTargets);
      }
    }

    setIsTargetDialogOpen(false);
    resetTargetForm(targetDraft.month_ref);
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button onClick={() => openNewTargetDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nova meta
          </Button>
        </div>
        <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          Metas recorrentes viram ocorrencias separadas. Se voce criar hoje uma meta para Seg, Ter e Qua, o sistema gera
          apenas as proximas segundas, tercas e quartas do mes.
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {visibleTargets.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {visibleTargets.map((target) => (
          <div key={target.id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{target.title}</p>
                  <Badge variant={target.is_active ? "secondary" : "outline"}>
                    {target.is_active ? "Ativa" : "Pausada"}
                  </Badge>
                  <Badge variant={target.status === "completed" ? "secondary" : "outline"}>
                    {target.status === "completed" ? "Batida" : "Pendente"}
                  </Badge>
                  <Badge variant="outline">{target.expected_date ?? target.month_ref.slice(0, 7)}</Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{targetTypeLabels[target.type]}</span>
                  <span>
                    Valor {target.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span>{describeTargetRecurrence(target)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {target.applies_to_cashflow && <Badge variant="secondary">Entra no fluxo</Badge>}
                  {target.offsets_monthly_bills && <Badge variant="secondary">Abate contas do mes</Badge>}
                </div>

                {target.completed_at && <p className="text-xs text-muted-foreground">Batida em {target.completed_at}.</p>}
                {target.notes && <p className="text-sm text-muted-foreground">{target.notes}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {target.status === "completed" ? (
                  <Button variant="outline" size="sm" onClick={() => void reopenMonthlyTarget(target.id)} disabled={isSyncing}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Desfazer
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void completeMonthlyTarget(target.id)} disabled={isSyncing}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Batida
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => openTargetForEdit(target)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => void deleteMonthlyTarget(target.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog
        open={isTargetDialogOpen}
        onOpenChange={(open) => {
          setIsTargetDialogOpen(open);
          if (!open) {
            resetTargetForm(targetDraft.month_ref || new Date().toISOString().slice(0, 7));
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTargetId ? "Editar meta mensal" : "Nova meta mensal"}</DialogTitle>
            <DialogDescription>
              Metas recorrentes viram ocorrencias separadas, uma para cada dia futuro valido dentro do mes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Titulo</Label>
              <Input
                className="mt-2"
                placeholder="Ex.: Meta side hustle abril"
                value={targetDraft.title}
                onChange={(event) => setTargetDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={targetDraft.type}
                  onValueChange={(value) =>
                    setTargetDraft((current) => ({
                      ...current,
                      type: value as MonthlyTargetType,
                      expected_date:
                        value === "side_hustle_goal" || value === "extra_income_goal"
                          ? current.expected_date || buildExpectedDate(current.month_ref, effectiveSettings.default_goal_day)
                          : current.expected_date,
                    }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(targetTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Mes de referencia</Label>
                <Input
                  className="mt-2"
                  type="month"
                  value={targetDraft.month_ref}
                  onChange={(event) =>
                    setTargetDraft((current) => {
                      const nextMonth = event.target.value;
                      const currentMonth = current.expected_date ? current.expected_date.slice(0, 7) : "";
                      const shouldShiftExpectedDate = !current.expected_date || currentMonth === current.month_ref;

                      return {
                        ...current,
                        month_ref: nextMonth,
                        expected_date: shouldShiftExpectedDate
                          ? buildExpectedDate(nextMonth, effectiveSettings.default_goal_day)
                          : current.expected_date,
                      };
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {targetDraft.recurrence_mode === "weekly" ? "Valor por ocorrencia" : "Valor"}
                </Label>
                <Input
                  className="mt-2"
                  type="number"
                  value={targetDraft.amount}
                  onChange={(event) => setTargetDraft((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Data prevista</Label>
                <Input
                  className="mt-2"
                  type="date"
                  disabled={targetDraft.recurrence_mode === "weekly"}
                  value={targetDraft.expected_date}
                  onChange={(event) => setTargetDraft((current) => ({ ...current, expected_date: event.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Modo da meta</Label>
                  <Select
                    value={targetDraft.recurrence_mode}
                    onValueChange={(value) =>
                      setTargetDraft((current) => ({
                        ...current,
                        recurrence_mode: value as typeof current.recurrence_mode,
                        expected_date:
                          value === "single"
                            ? current.expected_date || buildExpectedDate(current.month_ref, effectiveSettings.default_goal_day)
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Pontual</SelectItem>
                      <SelectItem value="weekly">Recorrente por dia da semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Maximo de ocorrencias</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min={1}
                    disabled={targetDraft.recurrence_mode !== "weekly"}
                    placeholder="Vazio = todas no mes"
                    value={targetDraft.recurrence_occurrences}
                    onChange={(event) => setTargetDraft((current) => ({ ...current, recurrence_occurrences: event.target.value }))}
                  />
                </div>
              </div>

              {targetDraft.recurrence_mode === "weekly" && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Dias da semana da recorrencia</p>
                  <div className="flex flex-wrap gap-2">
                    {weekdayLabels.map((weekday) => {
                      const checked = targetDraft.recurrence_weekdays.includes(weekday.value);
                      return (
                        <Button
                          key={weekday.value}
                          type="button"
                          size="sm"
                          variant={checked ? "default" : "outline"}
                          onClick={() =>
                            setTargetDraft((current) => ({
                              ...current,
                              recurrence_weekdays: checked
                                ? current.recurrence_weekdays.filter((value) => value !== weekday.value)
                                : [...current.recurrence_weekdays, weekday.value].sort((left, right) => left - right),
                            }))
                          }
                        >
                          {weekday.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exemplo: marcar Seg, Ter e Qua cria metas separadas de mesmo valor para todas as proximas segundas,
                    tercas e quartas desse mes.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Entrar no fluxo de caixa</p>
                  <p className="text-xs text-muted-foreground">Soma como entrada prevista na timeline.</p>
                </div>
                <Switch
                  checked={targetDraft.applies_to_cashflow}
                  onCheckedChange={(value) => setTargetDraft((current) => ({ ...current, applies_to_cashflow: value }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Abater contas do mes</p>
                  <p className="text-xs text-muted-foreground">Usa a meta para enxergar gasto liquido do mes.</p>
                </div>
                <Switch
                  checked={targetDraft.offsets_monthly_bills}
                  onCheckedChange={(value) => setTargetDraft((current) => ({ ...current, offsets_monthly_bills: value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Meta ativa</p>
                <p className="text-xs text-muted-foreground">Mantem o parametro valendo para os calculos.</p>
              </div>
              <Switch
                checked={targetDraft.is_active}
                onCheckedChange={(value) => setTargetDraft((current) => ({ ...current, is_active: value }))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Observacoes</Label>
              <Textarea
                className="mt-2"
                placeholder="Ex.: meta do side hustle do mes, teto de gastos para controlar saidas, limite de reinvestimento."
                value={targetDraft.notes}
                onChange={(event) => setTargetDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTargetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveMonthlyTarget()} disabled={isSyncing}>
              {editingTargetId ? "Salvar meta mensal" : "Criar meta mensal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
