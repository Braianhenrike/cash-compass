import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, isSupabaseConfigured } from "@/lib/env";
import { useAuth } from "@/providers/AuthProvider";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("Braianhenrike");
  const [email, setEmail] = useState("braianhgomes12@gmail.com");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [from, navigate, user]);

  const title = useMemo(
    () => (mode === "signin" ? "Entrar na sua operacao" : "Criar acesso local"),
    [mode],
  );

  if (!isLoading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn(email, password);
        setMessage("Sessao iniciada com sucesso.");
      } else {
        await signUp({ email, password, fullName });
        setMessage("Conta criada. Se o Supabase local exigir confirmacao, use o mesmo formulario para entrar depois.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel autenticar agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.32em] text-primary">{APP_NAME}</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-foreground">
            Painel financeiro pessoal para operar caixa, contas e bricks sem perder contexto.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            A sessao fica gravada neste navegador. Depois do primeiro login, voce nao precisa entrar de novo toda hora.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-border/80 bg-card/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Prioridade</p>
                <p className="mt-2 text-sm text-foreground">Fluxo de caixa e decisao de venda.</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dados</p>
                <p className="mt-2 text-sm text-foreground">Supabase local com persistencia real em portugues e BRL.</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sessao</p>
                <p className="mt-2 text-sm text-foreground">Persistida no navegador para uso individual.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-border/80 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "signin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("signin")}
                >
                  Entrar
                </Button>
                <Button
                  type="button"
                  variant={mode === "signup" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("signup")}
                >
                  Criar conta
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Use e-mail e senha. O Supabase Auth mantem sua sessao salva neste navegador.
            </p>
            {!isSupabaseConfigured && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                Supabase local ainda nao esta configurado nesta maquina. O codigo ja esta pronto; basta subir o stack local
                e preencher as variaveis do projeto.
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-9"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder="Sua senha"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {message && (
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Processando..." : mode === "signin" ? "Entrar no CashCompass" : "Criar conta"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
