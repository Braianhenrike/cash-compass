import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Bill, BrickItem, BrickCost, Category, Income, Settings, ScenarioType } from '@/types/finance';

const genId = () => crypto.randomUUID();

const DEFAULT_SETTINGS: Settings = {
  minimum_cash_reserve: 500,
  currency: 'BRL',
  default_scenario: 'probable',
  alerts_enabled: true,
  stale_brick_days: 30,
};

interface FinanceStore {
  currentCash: number;
  setCurrentCash: (v: number) => void;
  
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;

  categories: Category[];
  addCategory: (c: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;

  bills: Bill[];
  addBill: (b: Omit<Bill, 'id' | 'created_at'>) => void;
  updateBill: (id: string, b: Partial<Bill>) => void;
  deleteBill: (id: string) => void;

  incomes: Income[];
  addIncome: (i: Omit<Income, 'id' | 'created_at'>) => void;
  updateIncome: (id: string, i: Partial<Income>) => void;
  deleteIncome: (id: string) => void;

  bricks: BrickItem[];
  addBrick: (b: Omit<BrickItem, 'id' | 'created_at' | 'costs'>) => void;
  updateBrick: (id: string, b: Partial<BrickItem>) => void;
  deleteBrick: (id: string) => void;
  addBrickCost: (brickId: string, cost: Omit<BrickCost, 'id' | 'brick_item_id'>) => void;
  deleteBrickCost: (brickId: string, costId: string) => void;

  loadSeedData: () => void;
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      currentCash: 2500,
      setCurrentCash: (v) => set({ currentCash: v }),

      settings: DEFAULT_SETTINGS,
      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),

      categories: [
        { id: '1', type: 'bill', name: 'Moradia' },
        { id: '2', type: 'bill', name: 'Alimentação' },
        { id: '3', type: 'bill', name: 'Transporte' },
        { id: '4', type: 'bill', name: 'Saúde' },
        { id: '5', type: 'bill', name: 'Lazer' },
        { id: '6', type: 'income', name: 'Freelance' },
        { id: '7', type: 'income', name: 'Emprego' },
        { id: '8', type: 'brick', name: 'Eletrônicos' },
        { id: '9', type: 'brick', name: 'Roupas' },
        { id: '10', type: 'brick', name: 'Colecionáveis' },
      ],
      addCategory: (c) => set({ categories: [...get().categories, { ...c, id: genId() }] }),
      deleteCategory: (id) => set({ categories: get().categories.filter(c => c.id !== id) }),

      bills: [],
      addBill: (b) => set({ bills: [...get().bills, { ...b, id: genId(), created_at: new Date().toISOString() }] }),
      updateBill: (id, b) => set({ bills: get().bills.map(x => x.id === id ? { ...x, ...b } : x) }),
      deleteBill: (id) => set({ bills: get().bills.filter(x => x.id !== id) }),

      incomes: [],
      addIncome: (i) => set({ incomes: [...get().incomes, { ...i, id: genId(), created_at: new Date().toISOString() }] }),
      updateIncome: (id, i) => set({ incomes: get().incomes.map(x => x.id === id ? { ...x, ...i } : x) }),
      deleteIncome: (id) => set({ incomes: get().incomes.filter(x => x.id !== id) }),

      bricks: [],
      addBrick: (b) => set({ bricks: [...get().bricks, { ...b, id: genId(), created_at: new Date().toISOString(), costs: [] }] }),
      updateBrick: (id, b) => set({ bricks: get().bricks.map(x => x.id === id ? { ...x, ...b } : x) }),
      deleteBrick: (id) => set({ bricks: get().bricks.filter(x => x.id !== id) }),
      addBrickCost: (brickId, cost) => set({
        bricks: get().bricks.map(b => b.id === brickId ? {
          ...b,
          costs: [...b.costs, { ...cost, id: genId(), brick_item_id: brickId }]
        } : b)
      }),
      deleteBrickCost: (brickId, costId) => set({
        bricks: get().bricks.map(b => b.id === brickId ? {
          ...b,
          costs: b.costs.filter(c => c.id !== costId)
        } : b)
      }),

      loadSeedData: () => {
        const today = new Date();
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        const daysFromNow = (n: number) => {
          const d = new Date(today);
          d.setDate(d.getDate() + n);
          return fmt(d);
        };
        const daysAgo = (n: number) => daysFromNow(-n);

        set({
          currentCash: 3200,
          bills: [
            { id: genId(), description: 'Aluguel', category_id: '1', amount: 1500, due_date: daysFromNow(5), paid_date: null, is_recurring: true, recurrence_type: 'monthly', priority: 'critical', status: 'pending', notes: '', created_at: new Date().toISOString() },
            { id: genId(), description: 'Energia', category_id: '1', amount: 280, due_date: daysFromNow(10), paid_date: null, is_recurring: true, recurrence_type: 'monthly', priority: 'high', status: 'pending', notes: '', created_at: new Date().toISOString() },
            { id: genId(), description: 'Internet', category_id: '1', amount: 120, due_date: daysFromNow(15), paid_date: null, is_recurring: true, recurrence_type: 'monthly', priority: 'medium', status: 'pending', notes: '', created_at: new Date().toISOString() },
            { id: genId(), description: 'Mercado', category_id: '2', amount: 600, due_date: daysFromNow(3), paid_date: null, is_recurring: false, recurrence_type: 'none', priority: 'high', status: 'pending', notes: '', created_at: new Date().toISOString() },
            { id: genId(), description: 'Farmácia', category_id: '4', amount: 150, due_date: daysAgo(2), paid_date: null, is_recurring: false, recurrence_type: 'none', priority: 'medium', status: 'overdue', notes: '', created_at: new Date().toISOString() },
          ],
          incomes: [
            { id: genId(), type: 'side_hustle', description: 'Freelance design', amount: 800, expected_date: daysFromNow(2), received_date: null, status: 'confirmed', notes: '', created_at: new Date().toISOString() },
            { id: genId(), type: 'side_hustle', description: 'Consultoria', amount: 500, expected_date: daysFromNow(7), received_date: null, status: 'expected', notes: '', created_at: new Date().toISOString() },
            { id: genId(), type: 'salary', description: 'Salário', amount: 4500, expected_date: daysFromNow(20), received_date: null, status: 'expected', notes: '', created_at: new Date().toISOString() },
            { id: genId(), type: 'extra', description: 'Venda avulsa', amount: 200, expected_date: daysAgo(1), received_date: daysAgo(1), status: 'received', notes: '', created_at: new Date().toISOString() },
          ],
          bricks: [
            {
              id: genId(), name: 'iPhone 13 Pro', category_id: '8', purchase_price: 2200, target_sale_price: 3200,
              minimum_sale_price: 2800, probable_sale_price: 3000, purchase_date: daysAgo(15),
              expected_sale_date: daysFromNow(10), actual_sale_date: null, actual_sale_price: null,
              liquidity: 'high', risk_level: 'low', status: 'listed', sales_channel: 'Mercado Livre',
              notes: 'Em bom estado', rating: null, created_at: new Date().toISOString(),
              costs: [
                { id: genId(), brick_item_id: '', type: 'shipping', amount: 50, notes: 'Frete de compra' },
                { id: genId(), brick_item_id: '', type: 'accessories', amount: 80, notes: 'Capinha e película' },
              ]
            },
            {
              id: genId(), name: 'Nike Dunk Low', category_id: '9', purchase_price: 450, target_sale_price: 750,
              minimum_sale_price: 600, probable_sale_price: 680, purchase_date: daysAgo(30),
              expected_sale_date: daysFromNow(5), actual_sale_date: null, actual_sale_price: null,
              liquidity: 'medium', risk_level: 'medium', status: 'listed', sales_channel: 'Instagram',
              notes: 'Tamanho 42', rating: null, created_at: new Date().toISOString(),
              costs: [
                { id: genId(), brick_item_id: '', type: 'shipping', amount: 30, notes: '' },
              ]
            },
            {
              id: genId(), name: 'PS5 Controller', category_id: '8', purchase_price: 180, target_sale_price: 320,
              minimum_sale_price: 250, probable_sale_price: 290, purchase_date: daysAgo(45),
              expected_sale_date: null, actual_sale_date: daysAgo(5), actual_sale_price: 300,
              liquidity: 'high', risk_level: 'low', status: 'sold', sales_channel: 'OLX',
              notes: 'Vendido rápido', rating: 'excellent', created_at: new Date().toISOString(),
              costs: [
                { id: genId(), brick_item_id: '', type: 'fees', amount: 15, notes: 'Taxa OLX' },
              ]
            },
          ],
        });
      },
    }),
    { name: 'finance-store' }
  )
);
