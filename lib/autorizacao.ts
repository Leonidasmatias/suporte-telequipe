import { redirect } from "next/navigation";
import { getUsuarioAtual, type UsuarioSessao } from "@/lib/auth";
import { RECURSOS, ACOES, canAccess, canPerform, type Recurso, type Acao } from "@/lib/permissoes";

/**
 * ETAPA 3 — PERMISSÕES. Estratégia central de autorização do sistema.
 *
 * Tudo (páginas, Server Actions, a única rota de API) passa por este
 * arquivo — nenhum lugar do código deve escrever `if (usuario.perfil ===
 * "ADMIN")` diretamente; use sempre canAccess/canPerform/requireAdmin daqui,
 * para a regra ficar centralizada e testável em um único lugar.
 *
 * Três camadas de proteção (nenhuma delas sozinha é suficiente):
 *   1. Interface  — Sidebar.tsx e os componentes de ação usam canAccess/
 *      canPerform para não RENDERIZAR o que o usuário não pode usar.
 *   2. Rotas/páginas — cada page.tsx chama requireAuthenticatedUser() ou
 *      requireAdmin()/requireAccess() antes de renderizar qualquer dado.
 *   3. Backend — toda Server Action de escrita e a rota de API chamam
 *      requireAuthenticatedAction()/requireAdminAction()/
 *      requirePerformAction() de novo, de forma independente da UI. Um
 *      usuário que digite a URL manualmente, manipule o DevTools ou chame a
 *      Server Action/API diretamente com curl/fetch cai sempre nesta camada.
 *
 * As matrizes (RECURSOS/ACOES) e as funções puras canAccess/canPerform
 * vivem em lib/permissoes.ts, não aqui — esse módulo é reexportado abaixo.
 * O motivo é técnico: components/Sidebar.tsx é um Client Component e
 * precisa dessas funções para filtrar o menu, mas este arquivo (
 * lib/autorizacao.ts) importa lib/auth.ts, que usa `next/headers` — uma API
 * exclusiva de Server Component/Server Action. Se Sidebar importasse direto
 * daqui, o bundler tentaria colocar `next/headers` no bundle do cliente e o
 * build quebraria. lib/permissoes.ts não tem nenhuma dependência de
 * next/headers/next/navigation, então é seguro para o cliente.
 */

export { RECURSOS, ACOES, canAccess, canPerform };
export type { Recurso, Acao };

// ---------------------------------------------------------------------------
// Guards para Server Components (páginas) — usam redirect(), nunca "silenciam"
// ---------------------------------------------------------------------------

/**
 * Chame no topo de toda página que exige login. Não autenticado → /login.
 * Nunca redireciona para /login se já está em /login (evita loop).
 */
export async function requireAuthenticatedUser(): Promise<UsuarioSessao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Chame no topo de página admin-only. Não logado → /login. Logado sem ser ADMIN → /acesso-negado. */
export async function requireAdmin(): Promise<UsuarioSessao> {
  const usuario = await requireAuthenticatedUser();
  if (usuario.perfil !== "ADMIN") redirect("/acesso-negado");
  return usuario;
}

/** Chame no topo de página cujo acesso depende de um recurso específico da matriz. */
export async function requireAccess(recurso: Recurso): Promise<UsuarioSessao> {
  const usuario = await requireAuthenticatedUser();
  if (!canAccess(usuario, recurso)) redirect("/acesso-negado");
  return usuario;
}

// ---------------------------------------------------------------------------
// Guards para Server Actions e a rota de API — nunca usam redirect() (não faz
// sentido fora de uma navegação de página); lançam erro genérico (Server
// Actions) ou devolvem 401/403 (rota de API), sem vazar detalhes internos.
// ---------------------------------------------------------------------------

export class ErroNaoAutenticado extends Error {
  constructor() {
    super("Não autenticado. Faça login para continuar.");
    this.name = "ErroNaoAutenticado";
  }
}

export class ErroSemPermissao extends Error {
  constructor() {
    super("Seu perfil não tem permissão para executar esta ação.");
    this.name = "ErroSemPermissao";
  }
}

/** Use em toda Server Action que exige apenas estar logado. Lança erro (nunca vaza detalhe interno) se não estiver. */
export async function requireAuthenticatedAction(): Promise<UsuarioSessao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new ErroNaoAutenticado();
  return usuario;
}

/** Use em toda Server Action admin-only. */
export async function requireAdminAction(): Promise<UsuarioSessao> {
  const usuario = await requireAuthenticatedAction();
  if (usuario.perfil !== "ADMIN") throw new ErroSemPermissao();
  return usuario;
}

/** Use em toda Server Action cuja permissão depende de uma ação específica da matriz. */
export async function requirePerformAction(acao: Acao): Promise<UsuarioSessao> {
  const usuario = await requireAuthenticatedAction();
  if (!canPerform(usuario, acao)) throw new ErroSemPermissao();
  return usuario;
}

/**
 * Para a rota de API (app/suporte/exportar/route.ts): 401 se não autenticado,
 * 403 se autenticado mas sem permissão de acesso ao recurso, null se pode
 * prosseguir. Mensagens genéricas — nunca detalhe interno.
 */
export async function verificarAcessoApi(
  recurso: Recurso
): Promise<{ status: 401 | 403; body: { ok: false; error: string } } | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return { status: 401, body: { ok: false, error: "Não autenticado." } };
  }
  if (!canAccess(usuario, recurso)) {
    return { status: 403, body: { ok: false, error: "Sem permissão para acessar este recurso." } };
  }
  return null;
}
