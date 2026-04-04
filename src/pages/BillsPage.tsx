import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { CheckCircle, Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FormField from "@/components/app/FormField";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, normalizeBillStatus } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { Bill, BillPriority, BillStatus, RecurrenceType } from "@/types/finance";

const priorityColors: Record<BillPriority, ComponentProps<typeof Badge>["variant"]> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

const statusLabels: Record<BillStatus, string> = {
  pending: "Pendente",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const emptyForm = {
  description: "",
  category_id: "",
  amount: "",
  due_date: "",
  is_recurring: false,
  recurrence_type: "none" as RecurrenceType,
  priority: "medium" as BillPriority,
  notes: "",
};

export default function BillsPage() {
  const { bills, addBill, updateBill, deleteBill, categories, settings, isSyncing } = useFinanceStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, priority: settings.default_bill_priority });
  const billCategories = categories.filter((category) => category.type === "bill");

  const derivedBills = useMemo(
    () =>
      bills.map((bill) => ({
        ...bill,
        effectiveStatus: normalizeBillStatus(bill),
      })),
    [bills],
  );

  const filtered = derivedBills.filter((bill) => {
    if (filter !== "all" && bill.effectiveStatus !== filter) {
      return false;
    }
    if (categoryFilter !== "all" && bill.category_id !== categoryFilter) {
      return false;
    }
    if (priorityFilter !== "all" && bill.priority !== priorityFilter) {
      return false;
    }
    if (periodFilter === "this_month" && bill.due_date.slice(0, 7) !== new Date().toISOString().slice(0, 7)) {
      return false;
    }
    if (periodFilter === "next_15") {
      const today = new Date();
      const limit = new Date();
      limit.setDate(today.getDate() + 15);
      const due = new Date(`${bill.due_date}T00:00:00`);
      if (due < today || due > limit) {
        return false;
      }
    }
    if (periodFilter === "overdue" && bill.effectiveStatus !== "overdue") {
      return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((left, right) => left.due_date.localeCompare(right.due_date));
  const total = sorted
    .filter((bill) => bill.effectiveStatus === "pending" || bill.effectiveStatus === "overdue")
    .reduce((sum, bill) => sum + bill.amount, 0);

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, priority: settings.default_bill_priority });
  }

  function openForCreate() {
    resetForm();
    setOpen(true);
  }

  function openForEdit(bill: Bill) {
    setEditingId(bill.id);
    setForm({
      description: bill.description,
      category_id: bill.category_id ?? "",
      amount: String(bill.amount),
      due_date: bill.due_date,
      is_recurring: bill.is_recurring,
      recurrence_type: bill.recurrence_type,
      priority: bill.priority,
      notes: bill.notes,
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.description || !form.amount || !form.due_date) {
      return;
    }

    const payload = {
      description: form.description,
      category_id: form.category_id || null,
      amount: Number(form.amount),
      due_date: form.due_date,
      paid_date: null,
      is_recurring: form.is_recurring,
      recurrence_type: form.is_recurring ? form.recurrence_type : "none",
      priority: form.priority,
      status: "pending" as BillStatus,
      notes: form.notes,
    };

    if (editingId) {
      const currentBill = bills.find((bill) => bill.id === editingId);
      await updateBill(editingId, {
        ...payload,
        paid_date: currentBill?.paid_date ?? null,
        status: currentBill?.status ?? "pending",
      });
    } else {
      await addBill(payload);
    }

    resetForm();
    setOpen(false);
  }

  async function markPaid(id: string) {
    await updateBill(id, {
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
  }

  async function duplicateBill(bill: Bill) {
    await addBill({
      description: `${bill.description} (copia)`,
      category_id: bill.category_id,
      amount: bill.amount,
      due_date: bill.due_date,
      paid_date: null,
      is_recurring: bill.is_recurring,
      recurrence_type: bill.recurrence_type,
      priority: bill.priority,
      status: "pending",
      notes: bill.notes,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Contas a pagar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total pendente filtrado: {formatCurrency(total, settings.currency)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openForCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar conta" : "Nova conta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <FormField label="Descricao" hint="Nome curto da conta para aparecer no painel e na timeline.">
                <Input
                  placeholder="Ex.: Aluguel, Internet, Parcela do carro"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Valor" hint="Valor total que precisa sair do caixa nessa conta.">
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  />
                </FormField>
                <FormField label="Vencimento" hint="Dia em que a conta pressiona o caixa se ainda nao tiver sido paga.">
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Categoria" hint="Ajuda a agrupar a conta nos relatorios e filtros.">
                <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {billCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Prioridade" hint="Use critica ou alta quando a conta nao pode ser adiada.">
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as BillPriority })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Critica</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Recorrencia" hint="So vale quando a conta se repete em toda semana, mes ou ano.">
                  <Select
                    value={form.recurrence_type}
                    onValueChange={(value) => setForm({ ...form, recurrence_type: value as RecurrenceType })}
                    disabled={!form.is_recurring}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Recorrencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Conta recorrente</p>
                  <p className="text-xs text-muted-foreground">Ative se ela se repete automaticamente.</p>
                </div>
                <Switch checked={form.is_recurring} onCheckedChange={(checked) => setForm({ ...form, is_recurring: checked })} />
              </div>
              <FormField label="Observacoes" hint="Use para lembrar detalhes como parcelamento, regra de pagamento ou contexto da conta.">
                <Textarea placeholder="Observacoes da conta" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </FormField>
              <Button onClick={() => void handleSubmit()} className="w-full" disabled={isSyncing}>
                {editingId ? "Salvar alteracoes" : "Salvar conta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "pending", "overdue", "paid", "cancelled"].map((status) => (
          <Button key={status} variant={filter === status ? "default" : "ghost"} size="sm" onClick={() => setFilter(status)}>
            {status === "all" ? "Todas" : statusLabels[status as BillStatus]}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {billCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Critica</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer periodo</SelectItem>
            <SelectItem value="this_month">Este mes</SelectItem>
            <SelectItem value="next_15">Proximos 15 dias</SelectItem>
            <SelectItem value="overdue">Somente vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
        {sorted.map((bill) => {
          const category = categories.find((item) => item.id === bill.category_id);
          return (
            <Card key={bill.id} className={bill.effectiveStatus === "overdue" ? "border-destructive" : ""}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bill.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{bill.due_date}</span>
                    {category && <span>· {category.name}</span>}
                    {bill.is_recurring && <span>· recorrente {bill.recurrence_type}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={priorityColors[bill.priority]}>{bill.priority}</Badge>
                  <Badge
                    variant={
                      bill.effectiveStatus === "paid"
                        ? "secondary"
                        : bill.effectiveStatus === "overdue"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {statusLabels[bill.effectiveStatus]}
                  </Badge>
                  <span className="min-w-[96px] text-right text-sm font-semibold">
                    {formatCurrency(bill.amount, settings.currency)}
                  </span>
                  {bill.effectiveStatus !== "paid" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void markPaid(bill.id)}>
                      <CheckCircle className="h-4 w-4 text-positive" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForEdit(bill)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void duplicateBill(bill)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void deleteBill(bill.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
