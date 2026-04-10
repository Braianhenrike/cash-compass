import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

import { APP_NAME, isSupabaseConfigured, SUPABASE_URL } from "@/lib/env";

interface AppErrorBoundaryState {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro fatal na aplicacao:", error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-destructive/40 bg-card p-8 shadow-2xl shadow-black/20">
          <p className="text-xs uppercase tracking-[0.32em] text-primary">{APP_NAME}</p>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">A aplicacao encontrou um erro ao abrir.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Em vez de deixar a tela vazia, o CashCompass agora mostra o erro detectado para facilitar o diagnostico.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Erro detectado</p>
            <p className="mt-2 break-words font-mono text-sm text-foreground">
              {this.state.error.message || "Erro desconhecido durante a renderizacao."}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Variaveis do Supabase ausentes em producao. Configure `VITE_SUPABASE_URL` e
              `VITE_SUPABASE_PUBLISHABLE_KEY` no projeto da Vercel e faca um novo deploy.
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>URL atual do Supabase: {SUPABASE_URL}</p>
            <p className="mt-2">Depois de corrigir, recarregue a pagina para validar.</p>
          </div>
        </div>
      </div>
    );
  }
}
