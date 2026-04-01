import { useState } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { formatCurrency } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, currentCash, setCurrentCash, categories, addCategory, deleteCategory } = useFinanceStore();
  const [newCat, setNewCat] = useState({ type: 'bill' as 'bill' | 'income' | 'brick', name: '' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sans font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground font-mono">Parâmetros do sistema</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cash & Reserve */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Caixa & Reserva</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Dinheiro em mãos hoje</Label>
              <Input type="number" value={currentCash} onChange={e => setCurrentCash(parseFloat(e.target.value) || 0)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reserva mínima de caixa</Label>
              <Input type="number" value={settings.minimum_cash_reserve} onChange={e => updateSettings({ minimum_cash_reserve: parseFloat(e.target.value) || 0 })} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dias para brick parado</Label>
              <Input type="number" value={settings.stale_brick_days} onChange={e => updateSettings({ stale_brick_days: parseInt(e.target.value) || 30 })} className="font-mono" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Alertas ativados</Label>
              <Switch checked={settings.alerts_enabled} onCheckedChange={v => updateSettings({ alerts_enabled: v })} />
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Categorias</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(['bill', 'income', 'brick'] as const).map(type => (
              <div key={type}>
                <p className="text-xs text-muted-foreground mb-1 uppercase">{type === 'bill' ? 'Contas' : type === 'income' ? 'Entradas' : 'Bricks'}</p>
                <div className="flex flex-wrap gap-1">
                  {categories.filter(c => c.type === type).map(c => (
                    <Badge key={c.id} variant="secondary" className="text-xs gap-1">
                      {c.name}
                      <button onClick={() => deleteCategory(c.id)} className="hover:text-destructive ml-1">×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <select value={newCat.type} onChange={e => setNewCat({ ...newCat, type: e.target.value as any })} className="bg-input border border-border rounded px-2 py-1 text-sm">
                <option value="bill">Conta</option>
                <option value="income">Entrada</option>
                <option value="brick">Brick</option>
              </select>
              <Input placeholder="Nome" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="flex-1" />
              <Button size="sm" onClick={() => { if (newCat.name) { addCategory(newCat); setNewCat({ ...newCat, name: '' }); } }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Dados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" onClick={() => useFinanceStore.getState().loadSeedData()}>
            Carregar dados de exemplo
          </Button>
          <p className="text-xs text-muted-foreground">Os dados são armazenados localmente no navegador (localStorage). Para persistir em nuvem, conecte ao Lovable Cloud.</p>
        </CardContent>
      </Card>
    </div>
  );
}
