"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const bloqueadoPorEdicao = error.message?.includes("modo de edição");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md text-center">
        <h2 className="text-base font-semibold text-white">
          {bloqueadoPorEdicao ? "Ação bloqueada" : "Algo deu errado"}
        </h2>
        <p className="mt-2 text-sm text-graphite-400">
          {bloqueadoPorEdicao
            ? "Esta ação exige o modo de edição ativo. Destrave a edição na barra lateral com a senha e tente novamente."
            : "Ocorreu um erro inesperado ao processar esta página."}
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-4">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
