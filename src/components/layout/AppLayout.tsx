import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Receipt, ArrowDownCircle, Box, 
  CalendarDays, BarChart3, Settings, AlertTriangle
} from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bills', icon: Receipt, label: 'Contas' },
  { to: '/income', icon: ArrowDownCircle, label: 'Entradas' },
  { to: '/bricks', icon: Box, label: 'Bricks' },
  { to: '/cashflow', icon: CalendarDays, label: 'Fluxo de Caixa' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="font-sans text-lg font-bold text-primary tracking-tight">💰 CashOps</h1>
          <p className="text-xs text-muted-foreground font-mono">Painel Financeiro</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-primary font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">v1.0 — Solo Mode</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
