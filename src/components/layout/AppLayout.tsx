import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowDownCircle,
  BarChart3,
  Box,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShieldAlert,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAME, isSupabaseConfigured } from "@/lib/env";
import { useAuth } from "@/providers/AuthProvider";
import { useFinanceStore } from "@/stores/financeStore";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bills", icon: Receipt, label: "Contas" },
  { to: "/income", icon: ArrowDownCircle, label: "Entradas" },
  { to: "/bricks", icon: Box, label: "Bricks" },
  { to: "/cashflow", icon: CalendarDays, label: "Fluxo de Caixa" },
  { to: "/targets", icon: Target, label: "Metas" },
  { to: "/reports", icon: BarChart3, label: "Relatorios" },
  { to: "/imports", icon: FileSpreadsheet, label: "Importacao" },
  { to: "/settings", icon: Settings, label: "Configuracoes" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { error, isLoading, isSyncing, refresh } = useFinanceStore();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-border px-5 py-5">
          <p className="text-xs uppercase tracking-[0.32em] text-primary">CashCompass</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Painel financeiro de operacao pessoal</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          <div className="rounded-xl border border-border bg-card/70 p-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sessao</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {user?.user_metadata?.full_name || "Usuario unico"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card/70 p-3 text-xs text-muted-foreground">
            <p>{isLoading ? "Carregando dados..." : isSyncing ? "Sincronizando..." : "Dados sincronizados."}</p>
            {!isSupabaseConfigured && <p className="mt-2 text-warning-custom">Configure o Supabase local para autenticar.</p>}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Nao foi possivel carregar os dados do Supabase.</p>
                <p className="mt-1 text-destructive/80">{error.message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
