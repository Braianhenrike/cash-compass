export function getFriendlyErrorMessage(error: unknown, fallback = "Nao foi possivel concluir a operacao.") {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "").trim();
  const message = rawMessage.toLowerCase();

  if (!navigator.onLine) {
    return "Voce esta offline. Confira sua conexao e tente novamente.";
  }

  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return "Falha de rede ao falar com o Supabase. Tente novamente em instantes.";
  }

  if (message.includes("jwt") || message.includes("sessao") || message.includes("session")) {
    return "Sua sessao nao esta valida. Entre novamente para continuar.";
  }

  if (message.includes("permission") || message.includes("rls") || message.includes("not allowed")) {
    return "O acesso foi bloqueado pelas regras de seguranca. Revise a sessao ou as politicas do Supabase.";
  }

  if (!rawMessage) {
    return fallback;
  }

  return rawMessage;
}
