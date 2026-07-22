import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getUsuarioAtual, type UsuarioSessao } from "@/lib/auth";
import { RECURSOS, ACOES, canAccess, canPerform, type Recurso, type Acao } from "@/lib/permissoes";
import type { FiltrosSuporte } from "@/lib/suporte";

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

export type ResultadoAcessoApi =
  | { ok: true; usuario: UsuarioSessao }
  | { ok: false; status: 401 | 403; body: { ok: false; error: string } };

/**
 * Para a rota de API (app/suporte/exportar/route.ts): 401 se não autenticado,
 * 403 se autenticado mas sem permissão de acesso ao recurso, `{ ok: true,
 * usuario }` se pode prosseguir — o `usuario` é devolvido porque a rota
 * precisa dele para calcular o escopo (ver criarFiltroDeAcessoAtendimentos
 * abaixo); antes desta missão a função só devolvia `null` no sucesso, mas aí
 * a rota não tinha como saber QUEM está exportando, só que a exportação era
 * permitida. Mensagens de erro sempre genéricas — nunca detalhe interno.
 */
export async function verificarAcessoApi(recurso: Recurso): Promise<ResultadoAcessoApi> {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return { ok: false, status: 401, body: { ok: false, error: "Não autenticado." } };
  }
  if (!canAccess(usuario, recurso)) {
    return { ok: false, status: 403, body: { ok: false, error: "Sem permissão para acessar este recurso." } };
  }
  return { ok: true, usuario };
}

// ---------------------------------------------------------------------------
// ESCOPO DE ACESSO A ATENDIMENTOS (missão "Controle de visualização e
// exportação por perfil") — única fonte de verdade de "o que este usuário
// pode ver/editar/exportar em Suporte". Nenhuma página, Server Action ou
// rota deve calcular esta regra por conta própria (se algum dia existir mais
// de um jeito de restringir por perfil, é aqui que ele muda).
//
// Vínculo real usado: SupportTicket.usuarioResponsavelId (FK para Usuario,
// preenchido pela sessão na criação — nunca a partir de formulário). O campo
// `tecnicoResponsavel` (texto livre) nunca é usado para autorização — ver
// nota no schema.prisma.
// ---------------------------------------------------------------------------

/**
 * Escopo (cláusula `where` do Prisma) que toda consulta de SupportTicket
 * deve combinar com os filtros da tela via AND:
 *
 *   where: { AND: [criarFiltroDeAcessoAtendimentos(usuario), filtrosDaTela] }
 *
 * ADMIN → `{}` (nenhuma restrição adicional, escopo global). Qualquer outro
 * valor de perfil (TECNICO, ou um valor corrompido/desconhecido que não seja
 * literalmente "ADMIN") → restrito aos próprios atendimentos. A checagem é
 * por allowlist (`=== "ADMIN"`), não por blacklist (`!== "TECNICO"`), de
 * propósito: um perfil inválido/inesperado nunca cai no ramo global por
 * engano — falha sempre fechado (restritivo), nunca aberto.
 *
 * Atendimentos antigos (sem usuarioResponsavelId, registrados antes desta
 * migration) nunca aparecem para nenhum TECNICO — só para ADMIN — porque
 * `usuarioResponsavelId: usuario.id` nunca é `null`.
 */
export function criarFiltroDeAcessoAtendimentos(usuario: UsuarioSessao): Prisma.SupportTicketWhereInput {
  if (usuario.perfil === "ADMIN") return {};
  return { usuarioResponsavelId: usuario.id };
}

/**
 * Checagem pontual (sem consultar o banco) se um atendimento JÁ CARREGADO
 * pertence ao escopo do usuário — útil quando o atendimento já foi lido por
 * outro caminho e falta só validar a propriedade antes de agir sobre ele.
 * Prefira sempre restringir a própria consulta (`criarFiltroDeAcessoAtendimentos`
 * dentro do `where`) a carregar o registro primeiro e checar depois — esta
 * função é o complemento para os casos em que o dado já está em mãos.
 *
 * ADMIN sempre `true`. TECNICO só `true` se `usuarioResponsavelId` for
 * exatamente o dele — um atendimento legado (`usuarioResponsavelId: null`)
 * nunca é `true` para TECNICO, mesmo que o texto de `tecnicoResponsavel`
 * pareça coincidir com o nome dele.
 */
export function podeAcessarAtendimento(
  ticket: { usuarioResponsavelId: number | null },
  usuario: UsuarioSessao
): boolean {
  if (usuario.perfil === "ADMIN") return true;
  return ticket.usuarioResponsavelId === usuario.id;
}

/**
 * Remove, para quem não é ADMIN, os filtros que só fazem sentido para quem
 * enxerga todos os técnicos (hoje: "Técnico Responsável" — buscar por nome
 * de QUALQUER técnico). Chame antes de repassar os filtros da tela para
 * `buildWhereSuporte`, tanto na listagem quanto na exportação — assim um
 * parâmetro `tecnico` enviado manualmente por um TECNICO (via URL, query
 * string ou formulário adulterado) é sempre ignorado, nunca aplicado.
 * Os demais filtros (categoria, site, projeto, período, status, busca)
 * continuam funcionando normalmente dentro do escopo do usuário.
 */
export function filtrosPermitidosParaPerfil(filtros: FiltrosSuporte, usuario: UsuarioSessao): FiltrosSuporte {
  if (usuario.perfil === "ADMIN") return filtros;
  const { tecnico, ...resto } = filtros;
  return resto;
}
