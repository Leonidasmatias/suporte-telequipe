import type { Perfil, UsuarioSessao } from "@/lib/auth";

/**
 * Etapa 3 — matrizes de permissão puras (RECURSOS/ACOES + canAccess/
 * canPerform), separadas de lib/autorizacao.ts de propósito.
 *
 * components/Sidebar.tsx é um Client Component ("use client") e precisa
 * filtrar o menu com canAccess/RECURSOS — mas lib/autorizacao.ts também
 * importa lib/auth.ts, que usa `next/headers` (só existe em Server
 * Component/Server Action). Se Sidebar importasse de lib/autorizacao.ts
 * diretamente, o bundler tentaria incluir `next/headers` no bundle do
 * cliente e o build quebraria ("You're importing a component that needs
 * next/headers..."). Por isso este arquivo não importa nada de next/headers,
 * next/navigation nem lib/auth em runtime — só o *tipo* Perfil/UsuarioSessao
 * (import type é apagado na compilação, não vira código no bundle).
 *
 * lib/autorizacao.ts reexporta tudo daqui e adiciona os guards de
 * página/Server Action/API (que aí sim usam next/headers e next/navigation)
 * — nenhum outro arquivo do projeto precisa mudar o import.
 */

export const RECURSOS = {
  dashboard: "dashboard",
  atendimentos: "atendimentos",
  colaboradores: "colaboradores",
  equipes: "equipes",
  lideres: "lideres",
  matrizNokia: "matrizNokia",
  treinamentos: "treinamentos",
  relatorios: "relatorios",
  exportacoes: "exportacoes",
  insightsOperacionais: "insightsOperacionais",
  importacao: "importacao",
  usuarios: "usuarios",
  /**
   * Sprint v7.2 — ÚLTIMA REVISÃO. Recurso PRÓPRIO do Dashboard Executivo
   * (/suporte/dashboard), completamente desacoplado de `relatorios`. Nome
   * "dashboardExecutivo" (não "dashboard") de propósito: `dashboard` já
   * existe acima e protege a Home (/home) — reaproveitar aquele nome para
   * este novo recurso colidiria com um recurso já homologado.
   */
  dashboardExecutivo: "dashboardExecutivo",
} as const;

export type Recurso = (typeof RECURSOS)[keyof typeof RECURSOS];

/**
 * Matriz de acesso por página/módulo. Baseada nos módulos REAIS encontrados
 * no repositório (ver relatório de auditoria) — não nos nomes da
 * especificação quando eles não correspondem a nada implementado:
 *   - "Configurações" não existe como página no sistema hoje; por isso não
 *     tem entrada aqui e não foi criada nesta etapa (fora de escopo criar
 *     módulo novo). Se um dia existir, basta adicioná-la como admin-only.
 *   - "Suporte Técnico" e "Atendimentos" são a mesma página (/suporte) neste
 *     código — tratados como um recurso único (`atendimentos`).
 *   - "Equipes" e "Líderes" foram eliminados como conceitos na V6
 *     (reestruturação do Cadastro de Colaboradores) — as rotas /equipes e
 *     /lideres só existem como redirecionamento para /colaboradores e não
 *     expõem nenhuma tela própria; mantidas admin-only aqui por não fazerem
 *     parte da lista fechada de módulos liberados ao TECNICO.
 *
 * REVISÃO (auditoria de continuidade): a especificação lista, de forma
 * fechada e repetida, os módulos visíveis ao TECNICO como Home, Suporte,
 * Treinamentos, Matriz Nokia e Relatórios de Suporte — e proíbe
 * explicitamente Insights. A versão anterior desta matriz liberava
 * `colaboradores` e `insightsOperacionais` também para TECNICO; corrigido
 * abaixo para bater com a lista fechada da especificação (nega por padrão
 * o que não está explicitamente listado).
 */
const MATRIZ_RECURSOS: Record<Recurso, readonly Perfil[]> = {
  dashboard: ["ADMIN", "TECNICO"], // = "Home" para o TECNICO, "Dashboard" para o ADMIN — mesma página (/home)
  atendimentos: ["ADMIN", "TECNICO"], // = "Suporte"
  colaboradores: ["ADMIN"], // não está na lista fechada de módulos do TECNICO — só ADMIN
  equipes: ["ADMIN"], // rota desativada (V6), sem tela própria; admin-only por ser "gestão administrativa" pela especificação
  lideres: ["ADMIN"], // idem — não listado no acesso do TECNICO
  matrizNokia: ["ADMIN", "TECNICO"],
  treinamentos: ["ADMIN", "TECNICO"],
  relatorios: ["ADMIN", "TECNICO"], // = "Relatórios de Suporte" (única página de relatórios do sistema)
  exportacoes: ["ADMIN", "TECNICO"], // exportação da própria tela de Suporte — mesma regra de relatorios
  insightsOperacionais: ["ADMIN"], // especificação proíbe TECNICO explicitamente
  importacao: ["ADMIN"], // Smart Sync reestrutura o Cadastro Mestre — operação sensível, não listada para TECNICO
  usuarios: ["ADMIN"],
  // Sprint v7.2 — ÚLTIMA REVISÃO: mesmo acesso que o Dashboard Executivo já
  // tinha reaproveitando `relatorios` (ADMIN + TECNICO, TECNICO restrito aos
  // próprios atendimentos via criarFiltroDeAcessoAtendimentos) — só a
  // ENTRADA na matriz mudou de nome, o resultado de canAccess para quem já
  // usava a tela é idêntico.
  dashboardExecutivo: ["ADMIN", "TECNICO"],
};

/** Página/menu — TECNICO só vê o que a matriz autoriza para o perfil dele. */
export function canAccess(usuario: UsuarioSessao | null, recurso: Recurso): boolean {
  if (!usuario) return false;
  return MATRIZ_RECURSOS[recurso].includes(usuario.perfil);
}

/**
 * Ações sensíveis (o "verbo", não a página). Modeladas separadamente do
 * acesso à página porque em vários módulos o TECNICO pode VER mas não
 * ESCREVER (ex.: atendimentos: criar/editar/encerrar sim, excluir não — a
 * exclusão é "exclusão administrativa sensível" por definição da
 * especificação) e outros módulos (colaboradores, matriz Nokia,
 * treinamentos, insights, importação, usuários) são admin-only tanto para
 * leitura quanto para escrita — ver MATRIZ_RECURSOS acima.
 *
 * Onde a especificação não detalhava explicitamente (ex.: exclusão de
 * atendimento), a decisão foi pela opção mais segura: só ADMIN. Registrado
 * também no relatório de auditoria.
 */
export const ACOES = {
  "atendimentos.criar": "atendimentos.criar",
  "atendimentos.editar": "atendimentos.editar",
  "atendimentos.encerrar": "atendimentos.encerrar",
  "atendimentos.excluir": "atendimentos.excluir",
  "colaboradores.escrever": "colaboradores.escrever",
  "matrizNokia.escrever": "matrizNokia.escrever",
  "treinamentos.escrever": "treinamentos.escrever",
  "insights.escrever": "insights.escrever",
  "importacao.escrever": "importacao.escrever",
  "usuarios.escrever": "usuarios.escrever",
} as const;

export type Acao = (typeof ACOES)[keyof typeof ACOES];

const MATRIZ_ACOES: Record<Acao, readonly Perfil[]> = {
  "atendimentos.criar": ["ADMIN", "TECNICO"],
  "atendimentos.editar": ["ADMIN", "TECNICO"],
  "atendimentos.encerrar": ["ADMIN", "TECNICO"],
  "atendimentos.excluir": ["ADMIN"], // exclusão sensível
  "colaboradores.escrever": ["ADMIN"], // criar/editar/excluir/alternar status/Smart Sync — alteração estrutural do Cadastro Mestre
  "matrizNokia.escrever": ["ADMIN"], // criar/excluir avaliação de competência
  "treinamentos.escrever": ["ADMIN"], // criar/excluir treinamento
  "insights.escrever": ["ADMIN"], // criar treinamento sugerido (mesma superfície de treinamentos.escrever)
  "importacao.escrever": ["ADMIN"], // Smart Sync — ver importacao em RECURSOS
  "usuarios.escrever": ["ADMIN"], // gestão de usuários é sempre admin-only
};

/** Operação de escrita (criar/editar/excluir) — checagem independente da página. */
export function canPerform(usuario: UsuarioSessao | null, acao: Acao): boolean {
  if (!usuario) return false;
  return MATRIZ_ACOES[acao].includes(usuario.perfil);
}
