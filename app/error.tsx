"use client";

// Etapa 3 — quando uma Server Action é chamada diretamente por uma
// <form action={...}> (sem try/catch no componente cliente), um erro
// lançado por requireAuthenticatedAction/requireAdminAction/
// requirePerformAction (lib/autorizacao.ts) sobe até este error boundary.
// Trata os dois tipos sem vazar detalhe interno (stack, nome de arquivo etc).
function tipoErroAutorizacao(error: Error): "naoAutenticado" | "semPermissao" | null {
  if (error.name === "ErroNaoAutenticado") return "naoAutenticado";
  if (error.name === "ErroSemPermissao") return "semPermissao";
  return null;
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tipoAutorizacao = tipoErroAutorizacao(error);

  const titulo =
    tipoAutorizacao === "naoAutenticado"
      ? "Sessão expirada"
      : tipoAutorizacao === "semPermissao"
        ? "Acesso negado"
        : "Algo deu errado";

  const mensagem =
    tipoAutorizacao === "naoAutenticado"
      ? "Sua sessão expirou ou você não está mais autenticado. Faça login novamente para continuar."
      : tipoAutorizacao === "semPermissao"
        ? "Seu perfil não possui permissão para executar esta ação."
        : "Ocorreu um erro inesperado ao processar esta página.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md text-center">
        <h2 className="text-base font-semibold text-white">{titulo}</h2>
        <p className="mt-2 text-sm text-graphite-400">{mensagem}</p>
        {tipoAutorizacao === "naoAutenticado" ? (
          <a href="/login" className="btn-primary mt-4 inline-block">
            Ir para o login
          </a>
        ) : tipoAutorizacao === "semPermissao" ? (
          <a href="/home" className="btn-primary mt-4 inline-block">
            Voltar ao dashboard
          </a>
        ) : (
          <button type="button" onClick={reset} className="btn-primary mt-4">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
