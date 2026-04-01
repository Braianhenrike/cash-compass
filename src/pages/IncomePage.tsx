import { useState } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { formatCurrency } from '@/lib/calculations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { IncomeType, IncomeStatus } from '@/types/finance';

const typeLabels: Record<IncomeType, string> = {
  side_hustle: 'Side Hustle', salary: 'Salário', brick_sale: 'Venda Brick',
  investment_return: 'Retorno Invest.', transfer: 'Transferência', extra: 'Extra',
};

const statusLabels: Record<IncomeStatus, string> = {
  expected: 'Esperada', confirmed: 'Confirmada', received: 'Recebida', cancelled: 'Cancelada',
};

export default function IncomePage() {
  const { incomes, addIncome, updateIncome, deleteIncome } = useFinanceStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    type: 'side_hustle' as IncomeType, description: '', amount: '',
    expected_date: '', notes: '',
  });

  const filtered = filter === 'all' ? incomes : incomes.filter(i => i.status === filter);
  const sorted = [...filtered].sort((a, b) => a.expected_date.localeCompare(b.expected_date));

  const handleSubmit = () => {
    if (!form.description || !form.amount || !form.expected_date) return;
    addIncome({
      type: form.type, description: form.description, amount: parseFloat(form.amount),
      expected_date: form.expected_date, received_date: null, status: 'expected', notes: form.notes,
    });
    setForm({ type: 'side_hustle', description: '', amount: '', expected_date: '', notes: '' });
    setOpen(false);
  };

  const markReceived = (id: string) => updateIncome(id, { status: 'received', received_date: new Date().toISOString().split('T')[0] });

  const totalExpected = incomes.filter(i => i.status === 'expected' || i.status === 'confirmed').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-bold">Entradas</h1>
          <p className="text-sm text-muted-foreground font-mono">Previstas: {formatCurrency(totalExpected)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Entrada</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Entrada</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <Input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} />
              </div>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as IncomeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {['all', 'expected', 'confirmed', 'received', 'cancelled'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(s)}>
            {s === 'all' ? 'Todas' : statusLabels[s as IncomeStatus]}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma entrada cadastrada</p>}
        {sorted.map(inc => (
          <Card key={inc.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{inc.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">{inc.expected_date}</span>
                  <Badge variant="secondary" className="text-xs">{typeLabels[inc.type]}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={inc.status === 'received' ? 'secondary' : 'outline'} className="text-xs">{statusLabels[inc.status]}</Badge>
                <span className="font-mono text-sm font-semibold text-positive">{formatCurrency(inc.amount)}</span>
                {inc.status !== 'received' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markReceived(inc.id)}>
                    <CheckCircle className="h-4 w-4 text-positive" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteIncome(inc.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
