import { useState } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { formatCurrency, calcBrickMetrics, calcTotalInvested } from '@/lib/calculations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Eye, DollarSign, Copy, Pencil } from 'lucide-react';
import type { ComponentProps } from 'react';
import { BrickItem, BrickStatus, BrickLiquidity, BrickRisk, BrickCostType, BrickRating } from '@/types/finance';

const statusLabels: Record<BrickStatus, string> = {
  planned: 'Planejado', purchased: 'Comprado', listed: 'Anunciado',
  reserved: 'Reservado', sold: 'Vendido', cancelled: 'Cancelado', loss: 'Prejuízo',
};

const statusColors: Record<BrickStatus, ComponentProps<typeof Badge>['variant']> = {
  planned: 'secondary', purchased: 'outline', listed: 'outline',
  reserved: 'outline', sold: 'secondary', cancelled: 'secondary', loss: 'destructive',
};

export default function BricksPage() {
  const { bricks, addBrick, updateBrick, deleteBrick, addBrickCost, categories, settings, isSyncing } = useFinanceStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sellId, setSellId] = useState<string | null>(null);
  const [recentlySoldId, setRecentlySoldId] = useState<string | null>(null);
  const [sellForm, setSellForm] = useState({
    actual_sale_price: '',
    actual_sale_date: new Date().toISOString().split('T')[0],
    sales_channel: '',
  });
  const [filter, setFilter] = useState('all');
  const [costForm, setCostForm] = useState({ type: 'shipping' as BrickCostType, amount: '', notes: '' });

  const brickCategories = categories.filter(c => c.type === 'brick');

  const [form, setForm] = useState({
    name: '', category_id: '', purchase_price: '', target_sale_price: '',
    minimum_sale_price: '', probable_sale_price: '', purchase_date: '',
    expected_sale_date: '', liquidity: 'medium' as BrickLiquidity,
    risk_level: 'medium' as BrickRisk, status: 'planned' as BrickStatus,
    purchase_affects_cash_flow: true, reserve_invested_capital: false,
    reserve_profit_for_reinvestment: false, purchase_channel: '', sales_channel: '', notes: '',
  });

  const filtered = filter === 'all' ? bricks : bricks.filter(b => b.status === filter || b.id === recentlySoldId);
  const sorted = [...filtered].sort((a, b) => {
    if (a.id === recentlySoldId) return -1;
    if (b.id === recentlySoldId) return 1;
    return b.purchase_date.localeCompare(a.purchase_date);
  });
  const detailBrick = bricks.find(b => b.id === detailId);
  const recentlySoldBrick = bricks.find(b => b.id === recentlySoldId);

  const resetForm = () => {
    setEditingId(null);
    setDuplicateSourceId(null);
    setForm({
      name: '', category_id: '', purchase_price: '', target_sale_price: '',
      minimum_sale_price: '', probable_sale_price: '', purchase_date: '',
      expected_sale_date: '', liquidity: 'medium', risk_level: 'medium',
      status: 'planned', purchase_affects_cash_flow: true,
      reserve_invested_capital: false, reserve_profit_for_reinvestment: false,
      purchase_channel: '', sales_channel: '', notes: '',
    });
  };

  const openForDuplicate = (brick: BrickItem) => {
    setEditingId(null);
    setDuplicateSourceId(brick.id);
    setForm({
      name: brick.name,
      category_id: brick.category_id ?? '',
      purchase_price: String(brick.purchase_price),
      target_sale_price: String(brick.target_sale_price),
      minimum_sale_price: String(brick.minimum_sale_price),
      probable_sale_price: String(brick.probable_sale_price),
      purchase_date: new Date().toISOString().split('T')[0],
      expected_sale_date: '',
      liquidity: brick.liquidity,
      risk_level: brick.risk_level,
      status: ['planned', 'purchased', 'listed', 'reserved'].includes(brick.status) ? brick.status : 'planned',
      purchase_affects_cash_flow: brick.purchase_affects_cash_flow,
      reserve_invested_capital: brick.reserve_invested_capital,
      reserve_profit_for_reinvestment: brick.reserve_profit_for_reinvestment,
      purchase_channel: brick.purchase_channel,
      sales_channel: brick.sales_channel,
      notes: brick.notes,
    });
    setOpen(true);
  };

  const openForEdit = (brick: BrickItem) => {
    setDuplicateSourceId(null);
    setEditingId(brick.id);
    setForm({
      name: brick.name,
      category_id: brick.category_id ?? '',
      purchase_price: String(brick.purchase_price),
      target_sale_price: String(brick.target_sale_price),
      minimum_sale_price: String(brick.minimum_sale_price),
      probable_sale_price: String(brick.probable_sale_price),
      purchase_date: brick.purchase_date,
      expected_sale_date: brick.expected_sale_date ?? '',
      liquidity: brick.liquidity,
      risk_level: brick.risk_level,
      status: ['planned', 'purchased', 'listed', 'reserved'].includes(brick.status) ? brick.status : 'listed',
      purchase_affects_cash_flow: brick.purchase_affects_cash_flow,
      reserve_invested_capital: brick.reserve_invested_capital,
      reserve_profit_for_reinvestment: brick.reserve_profit_for_reinvestment,
      purchase_channel: brick.purchase_channel,
      sales_channel: brick.sales_channel,
      notes: brick.notes,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.purchase_price || !form.purchase_date) return;

    const sourceBrick = editingId
      ? bricks.find(brick => brick.id === editingId)
      : duplicateSourceId
        ? bricks.find(brick => brick.id === duplicateSourceId)
        : null;

    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      purchase_price: parseFloat(form.purchase_price),
      target_sale_price: parseFloat(form.target_sale_price) || 0,
      minimum_sale_price: parseFloat(form.minimum_sale_price) || 0,
      probable_sale_price: parseFloat(form.probable_sale_price) || 0,
      purchase_date: form.purchase_date,
      expected_sale_date: form.expected_sale_date || null,
      actual_sale_date: editingId ? sourceBrick?.actual_sale_date ?? null : null,
      actual_sale_price: editingId ? sourceBrick?.actual_sale_price ?? null : null,
      liquidity: form.liquidity,
      risk_level: form.risk_level,
      status: form.status,
      purchase_affects_cash_flow: form.purchase_affects_cash_flow,
      reserve_invested_capital: form.reserve_invested_capital,
      reserve_profit_for_reinvestment: form.reserve_profit_for_reinvestment,
      purchase_channel: form.purchase_channel,
      sales_channel: form.sales_channel,
      notes: form.notes,
      rating: editingId ? sourceBrick?.rating ?? null : null,
    };

    if (editingId) {
      await updateBrick(editingId, payload);
    } else {
      await addBrick(payload);
    }

    resetForm();
    setOpen(false);
  };

  const handleSell = async () => {
    if (!sellId || !sellForm.actual_sale_price) return;

    const soldBrick = bricks.find(brick => brick.id === sellId);
    if (!soldBrick) return;

    await updateBrick(sellId, {
      status: 'sold',
      actual_sale_date: sellForm.actual_sale_date,
      actual_sale_price: parseFloat(sellForm.actual_sale_price),
      sales_channel: sellForm.sales_channel,
      rating: soldBrick.rating ?? null,
    });

    setRecentlySoldId(soldBrick.id);
    setDetailId(soldBrick.id);
    setSellId(null);
    setSellForm({
      actual_sale_price: '',
      actual_sale_date: new Date().toISOString().split('T')[0],
      sales_channel: '',
    });
  };

  const handleAddCost = () => {
    if (!detailId || !costForm.amount) return;
    addBrickCost(detailId, { type: costForm.type, amount: parseFloat(costForm.amount), notes: costForm.notes });
    setCostForm({ type: 'shipping', amount: '', notes: '' });
  };

  const lockedCapital = bricks.filter(b => ['purchased', 'listed', 'reserved', 'planned'].includes(b.status)).reduce((s, b) => s + calcTotalInvested(b), 0);
  const totalProfit = bricks.filter(b => b.status === 'sold').reduce((s, b) => s + calcBrickMetrics(b).net_profit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-bold">Bricks</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Travado: {formatCurrency(lockedCapital, settings.currency)} · Lucro total: {formatCurrency(totalProfit, settings.currency)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Brick</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Editar brick' : duplicateSourceId ? 'Duplicar brick' : 'Novo brick'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome do item" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {brickCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as BrickStatus })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="purchased">Comprado</SelectItem>
                  <SelectItem value="listed">Anunciado</SelectItem>
                  <SelectItem value="reserved">Reservado</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Preço de compra" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
                <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" placeholder="Preço alvo" value={form.target_sale_price} onChange={e => setForm({ ...form, target_sale_price: e.target.value })} />
                <Input type="number" placeholder="Mín. aceitável" value={form.minimum_sale_price} onChange={e => setForm({ ...form, minimum_sale_price: e.target.value })} />
                <Input type="number" placeholder="Provável" value={form.probable_sale_price} onChange={e => setForm({ ...form, probable_sale_price: e.target.value })} />
              </div>
              <Input type="date" placeholder="Data esperada de venda" value={form.expected_sale_date} onChange={e => setForm({ ...form, expected_sale_date: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.liquidity} onValueChange={v => setForm({ ...form, liquidity: v as BrickLiquidity })}>
                  <SelectTrigger><SelectValue placeholder="Liquidez" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.risk_level} onValueChange={v => setForm({ ...form, risk_level: v as BrickRisk })}>
                  <SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Canal da compra" value={form.purchase_channel} onChange={e => setForm({ ...form, purchase_channel: e.target.value })} />
              <Input placeholder="Canal de venda" value={form.sales_channel} onChange={e => setForm({ ...form, sales_channel: e.target.value })} />
              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Desconta valor da compra do total em conta</p>
                    <p className="text-xs text-muted-foreground">Padrao marcado. Desmarque quando essa compra nao deve entrar no caixa operacional.</p>
                  </div>
                  <Switch checked={form.purchase_affects_cash_flow} onCheckedChange={checked => setForm({ ...form, purchase_affects_cash_flow: checked })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Proteger capital investido</p>
                    <p className="text-xs text-muted-foreground">Ao vender, o valor investido fica reservado e nao volta para pagar contas.</p>
                  </div>
                  <Switch checked={form.reserve_invested_capital} onCheckedChange={checked => setForm({ ...form, reserve_invested_capital: checked })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Reservar lucro para recompra</p>
                    <p className="text-xs text-muted-foreground">O lucro fica guardado para recompra ou aumento de patrimonio.</p>
                  </div>
                  <Switch checked={form.reserve_profit_for_reinvestment} onCheckedChange={checked => setForm({ ...form, reserve_profit_for_reinvestment: checked })} />
                </div>
              </div>
              <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={() => void handleSubmit()} className="w-full" disabled={isSyncing}>
                {editingId ? 'Salvar alteracoes' : duplicateSourceId ? 'Criar duplicacao' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'purchased', 'listed', 'reserved', 'sold', 'loss'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(s)}>
            {s === 'all' ? 'Todos' : statusLabels[s as BrickStatus]}
          </Button>
        ))}
      </div>

      {recentlySoldBrick && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{recentlySoldBrick.name}</span> acabou de ser marcado como vendido e segue visivel na lista para voce confirmar o status.
        </div>
      )}

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">Nenhum brick cadastrado</p>}
        {sorted.map(brick => {
          const m = calcBrickMetrics(brick);
          const cat = categories.find(c => c.id === brick.category_id);
          return (
            <Card key={brick.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{brick.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">Compra: {formatCurrency(brick.purchase_price, settings.currency)}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground font-mono">Investido: {formatCurrency(m.total_invested, settings.currency)}</span>
                      {brick.status === 'sold' && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className={`text-xs font-mono font-semibold ${m.net_profit >= 0 ? 'text-positive' : 'text-negative'}`}>
                            Lucro: {formatCurrency(m.net_profit, settings.currency)} ({m.roi_percent.toFixed(1)}%)
                          </span>
                        </>
                      )}
                      {cat && <Badge variant="secondary" className="text-xs">{cat.name}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{m.days_locked}d travado</span>
                      {brick.status === 'sold' && <span className="text-xs text-muted-foreground">· {formatCurrency(m.profit_per_day, settings.currency)}/dia</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {brick.id === recentlySoldId && <Badge variant="secondary" className="text-xs">Vendido agora</Badge>}
                    {!brick.purchase_affects_cash_flow && <Badge variant="secondary" className="text-xs">Nao desconta do caixa</Badge>}
                    {brick.reserve_invested_capital && <Badge variant="secondary" className="text-xs">Capital protegido</Badge>}
                    {brick.reserve_profit_for_reinvestment && <Badge variant="secondary" className="text-xs">Lucro reservado</Badge>}
                    <Badge variant="outline" className="text-xs">{brick.liquidity}</Badge>
                    <Badge variant={statusColors[brick.status]} className="text-xs">{statusLabels[brick.status]}</Badge>
                    {!['sold', 'cancelled', 'loss'].includes(brick.status) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setSellId(brick.id);
                        setSellForm({
                          actual_sale_price: String(brick.probable_sale_price),
                          actual_sale_date: new Date().toISOString().split('T')[0],
                          sales_channel: brick.sales_channel,
                        });
                      }}>
                        <DollarSign className="h-4 w-4 text-positive" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForDuplicate(brick)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!['sold', 'cancelled', 'loss'].includes(brick.status) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForEdit(brick)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailId(brick.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBrick(brick.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sell Dialog */}
      <Dialog open={!!sellId} onOpenChange={() => setSellId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Venda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" placeholder="Valor de venda" value={sellForm.actual_sale_price} onChange={e => setSellForm({ ...sellForm, actual_sale_price: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={sellForm.actual_sale_date} onChange={e => setSellForm({ ...sellForm, actual_sale_date: e.target.value })} />
              <Input placeholder="Canal de venda" value={sellForm.sales_channel} onChange={e => setSellForm({ ...sellForm, sales_channel: e.target.value })} />
            </div>
            <Button onClick={() => void handleSell()} className="w-full" disabled={isSyncing}>Confirmar Venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailBrick?.name}</DialogTitle></DialogHeader>
          {detailBrick && (() => {
            const m = calcBrickMetrics(detailBrick);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Compra:</span> <span className="font-mono">{formatCurrency(detailBrick.purchase_price)}</span></div>
                  <div><span className="text-muted-foreground">Total investido:</span> <span className="font-mono">{formatCurrency(m.total_invested)}</span></div>
                  <div><span className="text-muted-foreground">Preço alvo:</span> <span className="font-mono">{formatCurrency(detailBrick.target_sale_price)}</span></div>
                  <div><span className="text-muted-foreground">Preço provável:</span> <span className="font-mono">{formatCurrency(detailBrick.probable_sale_price)}</span></div>
                  <div><span className="text-muted-foreground">Mínimo:</span> <span className="font-mono">{formatCurrency(detailBrick.minimum_sale_price)}</span></div>
                  <div><span className="text-muted-foreground">Dias travado:</span> <span className="font-mono">{m.days_locked}</span></div>
                  <div><span className="text-muted-foreground">ROI:</span> <span className="font-mono">{m.roi_percent.toFixed(1)}%</span></div>
                  <div><span className="text-muted-foreground">Margem:</span> <span className="font-mono">{m.margin_percent.toFixed(1)}%</span></div>
                  <div><span className="text-muted-foreground">Lucro/dia:</span> <span className="font-mono">{formatCurrency(m.profit_per_day)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-xs">{statusLabels[detailBrick.status]}</Badge></div>
                </div>

                {/* Rating */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avaliação:</p>
                  <div className="flex gap-2">
                    {(['bad', 'good', 'excellent'] as BrickRating[]).map(r => (
                      <Button key={r} size="sm" variant={detailBrick.rating === r ? 'default' : 'ghost'}
                        onClick={() => updateBrick(detailBrick.id, { rating: r })}>
                        {r === 'bad' ? '?? Ruim' : r === 'good' ? '?? Bom' : '?? Excelente'}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Costs */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Custos extras:</p>
                  {detailBrick.costs.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                      <span>{c.type}: {c.notes}</span>
                      <span className="font-mono">{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Select value={costForm.type} onValueChange={v => setCostForm({ ...costForm, type: v as BrickCostType })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['shipping', 'maintenance', 'transport', 'commission', 'fees', 'accessories', 'other'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Valor" value={costForm.amount} onChange={e => setCostForm({ ...costForm, amount: e.target.value })} className="w-24" />
                    <Button size="sm" onClick={handleAddCost}>+</Button>
                  </div>
                </div>

                {detailBrick.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas:</p>
                    <p className="text-sm">{detailBrick.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

