import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Página de erro de autorização (403). Não mostra nenhum detalhe técnico —
 * só a mensagem exigida pela especificação e um caminho de volta seguro.
 * Chegar aqui já significa que o usuário ESTÁ autenticado (quem não está
 * autenticado é mandado para /login, não para cá — ver lib/autorizacao.ts).
 */
export default function AcessoNegadoPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <h1 className="text-lg font-semibold text-white">Acesso negado</h1>
        <p className="mt-1 text-sm text-graphite-400">Seu perfil não possui permissão para acessar esta área.</p>
      </div>
      <Link href="/home" className="btn-primary">
        Voltar ao dashboard
      </Link>
    </div>
  );
}
