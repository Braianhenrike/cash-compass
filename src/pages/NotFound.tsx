import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("Rota nao encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-2xl border border-border bg-card px-8 py-10 text-center">
        <h1 className="text-4xl font-semibold">404</h1>
        <p className="mt-3 text-muted-foreground">A tela que voce tentou abrir nao existe.</p>
        <a href="/" className="mt-4 inline-block text-primary underline underline-offset-4">
          Voltar para o dashboard
        </a>
      </div>
    </div>
  );
}
