import { useMemo, useState } from "react";
import { CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FormField from "@/components/app/FormField";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/calculations";
import { useFinanceStore } from "@/stores/financeStore";
import type { IncomeStatus, IncomeType } from "@/types/finance";

const typeLabels: Record<IncomeType, string> = {
  side_hustle: "Side hustle",
  salary: "Salario",
  brick_sale: "Venda de brick",
  investment_return: "Retorno de investimento",
  transfer: "Transferencia",
  extra: "Entrada extra",
};

const statusLabels: Record<IncomeStatus, string> = {
  expected: "Esperada",
  confirmed: "Confirmada",
  received: "Recebida",
  cancelled: "Cancelada",
};

const emptyForm = {
  type: "side_hustle" as IncomeType,
  category_id: "",
  description: "",
  amount: "",
  expected_date: "",
  source: "",
  notes: "",
};

export default function IncomePage() {
  const { incomes, addIncome, updateIncome, deleteIncome, settings, categories, isSyncing } = useFinanceStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const incomeCategories = categories.filter((category) => category.type === "income");

  const filtered = incomes.filter((income) => {
    if (filter !== "all" && income.status !== filter) {
      return false;
    }
    if (typeFilter !== "all" && income.type !== typeFilter) {
      return false;
    }
    if (categoryFilter !== "all" && income.category_id !== categoryFilter) {
      return false;
    }
    if (periodFilter === "this_month" && income.expected_date.slice(0, 7) !== new Date().toISOString().slice(0, 7)) {
      return false;
    }
    if (periodFilter === "next_15") {
      const today = new Date();
      const limit = new Date();
      limit.setDate(today.getDate() + 15);
      const due = new Date(`${income.expected_date}T00:00:00`);
      if (due < today || due > limit) {
        return false;
      }
    }
    return true;
  });
  const sorted = useMemo(
    () => [...filtered].sort((left, right) => left.expected_date.localeCompare(right.expected_date)),
    [filtered],
  );
  const totalExpected = incomes
    .filter((income) => income.status === "expected" || income.status === "confirmed")
    .reduce((sum, income) => sum + income.amount, 0);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function openForCreate() {
    resetForm();
    setOpen(true);
  }

  function openForEdit(incomeId: string) {
    const income = incomes.find((item) => item.id === incomeId);
    if (!income) {
      return;
    }

    setEditingId(income.id);
    setForm({
      type: income.type,
      category_id: income.category_id ?? "",
      description: income.description,
      amount: String(income.amount),
      expected_date: income.expected_date,
      source: income.source,
      notes: income.notes,
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.description || !form.amount || !form.expected_date) {
      return;
    }

    const payload = {
      type: form.type,
      category_id: form.category_id || null,
      description: form.description,
      amount: Number(form.amount),
      expected_date: form.expected_date,
      received_date: null,
      status: "expected" as IncomeStatus,
      source: form.source,
      notes: form.notes,
    };

    if (editingId) {
      const currentIncome = incomes.find((income) => income.id === editingId);
      await updateIncome(editingId, {
        ...payload,
        received_date: currentIncome?.received_date ?? null,
        status: currentIncome?.status ?? "expected",
      });
    } else {
      await addIncome(payload);
    }

    resetForm();
    setOpen(false);
  }

  async function markReceived(id: string) {
    await updateIncome(id, {
      status: "received",
      received_date: new Date().toISOString().split("T")[0],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Entradas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Previstas: {formatCurrency(totalExpected, settings.currency)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openForCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Nova entrada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar entrada" : "Nova entrada"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <FormField label="Descricao" hint="Nome da entrada para ficar clara no dashboard e nos filtros.">
                <Input placeholder="Ex.: Freela da semana, salario, retorno de venda" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Valor" hint="Quanto deve entrar no caixa quando essa entrada acontecer.">
                  <Input type="number" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                </FormField>
                <FormField label="Data esperada" hint="Dia previsto para o dinheiro entrar.">
                  <Input type="date" value={form.expected_date} onChange={(event) => setForm({ ...form, expected_date: event.target.value })} />
                </FormField>
              </div>
              <FormField label="Tipo" hint="Define como essa entrada aparece nos relatorios e metas.">
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as IncomeType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Categoria" hint="Ajuda a filtrar a origem da entrada e comparar periodos.">
                <Select value={form.category_id} onValueChange={(value) => setForm({ ...form, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Origem" hint="De onde vem o dinheiro: cliente, empresa, marketplace, transferencia etc.">
                <Input placeholder="Origem" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
              </FormField>
              <FormField label="Observacoes" hint="Use para guardar contexto, combinados, previsoes ou ajustes da entrada.">
                <Textarea placeholder="Observacoes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </FormField>
              <Button onClick={() => void handleSubmit()} className="w-full" disabled={isSyncing}>
                {editingId ? "Salvar alteracoes" : "Salvar entrada"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "expected", "confirmed", "received", "cancelled"].map((status) => (
          <Button key={status} variant={filter === status ? "default" : "ghost"} size="sm" onClick={() => setFilter(status)}>
            {status === "all" ? "Todas" : statusLabels[status as IncomeStatus]}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {incomeCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
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
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrada cadastrada.</p>}
        {sorted.map((income) => {
          const category = categories.find((item) => item.id === income.category_id);
          return (
            <Card key={income.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium">{income.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{income.expected_date}</span>
                    <span>· {typeLabels[income.type]}</span>
                    {category && <span>· {category.name}</span>}
                    {income.source && <span>· {income.source}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={income.status === "received" ? "secondary" : "outline"}>{statusLabels[income.status]}</Badge>
                  <span className="min-w-[96px] text-right text-sm font-semibold text-positive">
                    {formatCurrency(income.amount, settings.currency)}
                  </span>
                  {income.status !== "received" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void markReceived(income.id)}>
                      <CheckCircle className="h-4 w-4 text-positive" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForEdit(income.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void deleteIncome(income.id)}>
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
