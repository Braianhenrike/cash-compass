import { useState } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { formatCurrency } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { Bill, BillPriority, BillStatus, RecurrenceType } from '@/types/finance';

const priorityColors: Record<BillPriority, string> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
};

const statusLabels: Record<BillStatus, string> = {
  pending: 'Pendente',
  paid: 'Paga',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};

export default function BillsPage() {
  const { bills, addBill, updateBill, deleteBill, categories } = useFinanceStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const [form, setForm] = useState({
    description: '', category_id: '', amount: '', due_date: '',
    is_recurring: false, recurrence_type: 'none' as RecurrenceType,
    priority: 'medium' as BillPriority, notes: '',
  });

  const billCategories = categories.filter(c => c.type === 'bill');
  const filtered = filter === 'all' ? bills : bills.filter(b => b.status === filter);
  const sorted = [...filtered].sort((a, b) => a.due_date.localeCompare(b.due_date));

  const handleSubmit = () => {
    if (!form.description || !form.amount || !form.due_date) return;
    addBill({
      description: form.description,
      category_id: form.category_id || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      paid_date: null,
      is_recurring: form.is_recurring,
      recurrence_type: form.recurrence_type,
      priority: form.priority,
      status: 'pending',
      notes: form.notes,
    });
    setForm({ description: '', category_id: '', amount: '', due_date: '', is_recurring: false, recurrence_type: 'none', priority: 'medium', notes: '' });
    setOpen(false);
  };

  const markPaid = (id: string) => updateBill(id, { status: 'paid', paid_date: new Date().toISOString().split('T')[0] });

  const total = sorted.filter(b => b.status === 'pending' || b.status === 'overdue').reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-bold">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground font-mono">Total pendente: {formatCurrency(total)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {billCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as BillPriority })}>
                <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'overdue', 'paid', 'cancelled'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(s)}>
            {s === 'all' ? 'Todas' : statusLabels[s as BillStatus]}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma conta cadastrada</p>}
        {sorted.map(bill => {
          const cat = categories.find(c => c.id === bill.category_id);
          const isOverdue = bill.status === 'pending' && bill.due_date < new Date().toISOString().split('T')[0];
          if (isOverdue && bill.status === 'pending') {
            // auto-mark
          }
          return (
            <Card key={bill.id} className={isOverdue ? 'border-destructive' : ''}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{bill.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{bill.due_date}</span>
                      {cat && <span className="text-xs text-muted-foreground">· {cat.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={priorityColors[bill.priority] as any} className="text-xs">{bill.priority}</Badge>
                  <Badge variant={bill.status === 'paid' ? 'secondary' : bill.status === 'overdue' || isOverdue ? 'destructive' : 'outline'} className="text-xs">
                    {isOverdue ? 'Vencida' : statusLabels[bill.status]}
                  </Badge>
                  <span className="font-mono text-sm font-semibold min-w-[80px] text-right">{formatCurrency(bill.amount)}</span>
                  {bill.status !== 'paid' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markPaid(bill.id)}>
                      <CheckCircle className="h-4 w-4 text-positive" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBill(bill.id)}>
                    <Trash2 className="h-3 w-3" />
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
