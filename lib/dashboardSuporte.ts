import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { categoriaPrincipalValida, obterCategoriasPrincipais } from "@/lib/categoriasSuporte";
import { buildWhereSuporte } from "@/lib/suporte";
import { classificarProjetoRegionalHistorico, listarProjetos as listarProjetosOficiaisMatriz, PROJETO_NAO_CLASSIFICADO } from "@/lib/projetoRegional";

/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte" + REVISÃO (Centro de
 * Controle Operacional).
 *
 * Módulo isolado: contém só os cálculos de indicadores/filtros/drill-down do
 * Dashboard Executivo. NÃO duplica nenhuma regra de classificação — reaproveita
 * `categoriaPrincipalValida`/`obterCategoriasPrincipais`
 * (lib/categoriasSuporte.ts — reescrito na missão v7.3, que eliminou o nível
 * "Projeto" por Fabricante da hierarquia de categorias) e, a
 * partir desta revisão, também `buildWhereSuporte` (lib/suporte.ts, só
 * ADITIVAMENTE estendido com os campos `resultado`/`regional` — ver aquele
 * arquivo) para Projeto/Categoria/Técnico/Período, em vez de reimplementar a
 * mesma lógica de filtro aqui — assim o dashboard nunca corre o risco de
 * divergir da regra de filtragem já homologada em /suporte.
 *
 * PERFORMANCE (regra explícita da missão: "evitar consultas duplicadas",
 * "preferir uma única consulta agregada"): `getIndicadoresExecutivosSuporte`
 * continua fazendo uma única `findMany` (agora com mais campos selecionados,
 * para os novos KPIs/dimensões) e TODOS os indicadores/gráficos/rankings são
 * calculados em uma única passagem em memória sobre esse mesmo resultado. A
 * única consulta adicional desta revisão é `obterRegionaisDisponiveis`, que
 * só popula as opções do `<select>` de Regional no painel de filtros — mesmo
 * padrão já usado por `/suporte` e `/relatorios/suporte` para o `<select>` de
 * Colaborador (uma consulta pequena e independente, em paralelo via
 * `Promise.all`, nunca repetida por card/gráfico).
 */

export type ContagemNome = { nome: string; quantidade: number };
export type PontoEvolucaoDiaria = { data: string; quantidade: number };
/** Estrutura do novo gráfico "Chamados por Projeto e Regional" (missão "Evolução 7.1"). */
export type ContagemProjetoRegional = { projeto: string; regionais: Record<string, number>; total: number };

export const TAMANHO_TOP = 10;
export const NAO_CLASSIFICADO = "Não classificado";
export const SEM_SUBCATEGORIA = "Sem subcategoria";
export const TECNICO_NAO_INFORMADO = "Técnico não informado";
export const REGIONAL_NAO_INFORMADA = "Regional não informada";

/**
 * KPI "Chamados Dentro do SLA" / "Chamados Atrasados" (nova nesta revisão):
 * como ainda não existe um SLA cadastrado por Projeto/Categoria no banco, a
 * missão pede explicitamente uma constante central configurável — este é o
 * único lugar do sistema que a define; se um dia existir SLA por
 * Projeto/Cliente, é aqui que a lógica muda.
 */
export const SLA_PADRAO_HORAS = 24;

export const STATUS_EXECUTIVO_OPCOES = ["Aberto", "Em Atendimento", "Concluído", "Cancelado"] as const;
export type StatusExecutivo = (typeof STATUS_EXECUTIVO_OPCOES)[number];

export type IndicadoresExecutivosSuporte = {
  totalChamados: number;
  emAberto: number;
  emAtendimento: number;
  concluidos: number;
  cancelados: number;
  /** Um item por Categoria Principal oficial, sempre presente mesmo com 0, mais "Não classificado" ao final quando houver pelo menos 1. */
  porCategoria: ContagemNome[];
  /** Aberto / Em Atendimento / Concluído / Cancelado — ver `statusExecutivo` abaixo para a regra de mapeamento. */
  porStatusExecutivo: ContagemNome[];
  /** KPIs Operacionais (novos nesta revisão). Toda a lógica está centralizada neste arquivo. */
  tempoMedioAtendimentoMinutos: number | null;
  tempoMedioResolucaoMinutos: number | null;
  chamadosAtrasados: number;
  chamadosDentroDoSLA: number;
  topCategorias: ContagemNome[];
  topSubcategorias: ContagemNome[];
  /** Sem lista oficial fixa (Regional/Técnico são texto livre) — usado tanto para o gráfico quanto para o ranking Top 10 (mesmo array, ver nota em app/suporte/dashboard/page.tsx). */
  topTecnicos: ContagemNome[];
  topRegionais: ContagemNome[];
  /** Ordenado por data crescente. Cobre TODO o histórico dentro do `where` recebido — a tela decide quantos dias exibir. */
  evolucaoDiaria: PontoEvolucaoDiaria[];
  /** Novo gráfico "Chamados por Projeto e Regional" (missão "Evolução 7.1") — ver `calcularChamadosPorProjetoRegional`. */
  chamadosPorProjetoRegional: ContagemProjetoRegional[];
};

/**
 * Bucket "executivo" de status, unificando o campo `status` (Aberto/Em
 * Atendimento/Finalizado) com o resultado "Cancelado" (que no modelo de
 * dados atual é um valor de `resultado`, não de `status` — ver
 * `RESULTADOS_SUPORTE` em lib/suporte.ts). Regra, em ordem de prioridade:
 *  1. Se o resultado registrado for "Cancelado", o atendimento conta como
 *     "Cancelado" no dashboard executivo, independentemente do status atual.
 *  2. Senão, se o status for "Finalizado", conta como "Concluído".
 *  3. Senão, usa o próprio status ("Aberto" ou "Em Atendimento").
 * Esta é uma decisão de exibição apenas — nenhum dado gravado é alterado, e
 * `lib/suporte.ts`/`STATUS_SUPORTE` continuam exatamente como estavam.
 */
function statusExecutivo(status: string, resultado: string): StatusExecutivo {
  if (resultado === "Cancelado") return "Cancelado";
  if (status === "Finalizado") return "Concluído";
  if (status === "Em Atendimento") return "Em Atendimento";
  return "Aberto";
}

function ordenarDesc(mapa: Map<string, number>): ContagemNome[] {
  return Array.from(mapa.entries())
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
}

function incrementar(mapa: Map<string, number>, chave: string): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
}

/** Junta uma lista fixa (sempre presente, mesmo com 0) com o total de "Não classificado" apurado (só aparece se > 0). */
function comBucketNaoClassificado(fixos: string[], mapa: Map<string, number>): ContagemNome[] {
  const lista: ContagemNome[] = fixos.map((nome) => ({ nome, quantidade: mapa.get(nome) ?? 0 }));
  const naoClassificado = mapa.get(NAO_CLASSIFICADO) ?? 0;
  if (naoClassificado > 0) lista.push({ nome: NAO_CLASSIFICADO, quantidade: naoClassificado });
  return lista;
}

type TicketParaIndicadores = {
  status: string;
  resultado: string;
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  dataAtendimento: Date;
  tempoAtendimento: number | null;
  tecnicoResponsavel: string | null;
  createdAt: Date;
  updatedAt: Date;
  colaborador: { regional: string | null } | null;
  /** Missão "Evolução 7.1" — Projeto/Regional do PRÓPRIO chamado (matriz oficial, lib/projetoRegional.ts), distintos do Regional do Colaborador acima. */
  projeto: string | null;
  regional: string | null;
};

/**
 * Agrega "Chamados por Projeto e Regional" (novo gráfico do Dashboard
 * Executivo, missão "Evolução 7.1") a partir de uma lista de chamados já
 * filtrada (mesmo escopo/Filtros Globais de `getIndicadoresExecutivosSuporte`
 * — nunca uma consulta própria, para nunca contar um chamado duas vezes nem
 * divergir dos demais indicadores da página).
 *
 * Função pura e testável (regra explícita da missão) — recebe só os campos
 * `projeto`/`regional` de cada chamado, sem nenhuma dependência do Prisma.
 * Cada par é classificado por `classificarProjetoRegionalHistorico`
 * (lib/projetoRegional.ts, fonte única — nunca duplicada aqui): chamados
 * antigos sem Projeto/Regional oficial, ou com uma combinação fora da
 * matriz atual, continuam visíveis nos buckets "Projeto não
 * classificado"/"Regional não classificada"/"Combinação histórica", nunca
 * excluídos.
 *
 * Só aparecem no resultado os Projetos que realmente possuem pelo menos 1
 * chamado no conjunto recebido (requisito explícito da missão) — ordenados
 * pela ordem oficial da matriz (`listarProjetos()`), com "Projeto não
 * classificado" sempre por último, quando presente.
 */
export function calcularChamadosPorProjetoRegional(
  tickets: { projeto: string | null; regional: string | null }[]
): ContagemProjetoRegional[] {
  const ordemProjetos: string[] = listarProjetosOficiaisMatriz();
  const porProjeto = new Map<string, Map<string, number>>();

  for (const t of tickets) {
    const classificado = classificarProjetoRegionalHistorico(t.projeto, t.regional);
    if (!porProjeto.has(classificado.projeto)) porProjeto.set(classificado.projeto, new Map());
    const mapaRegionais = porProjeto.get(classificado.projeto)!;
    mapaRegionais.set(classificado.regional, (mapaRegionais.get(classificado.regional) ?? 0) + 1);
  }

  function paraContagem(projeto: string): ContagemProjetoRegional {
    const mapaRegionais = porProjeto.get(projeto)!;
    const regionais: Record<string, number> = {};
    let total = 0;
    for (const [regional, quantidade] of mapaRegionais.entries()) {
      regionais[regional] = quantidade;
      total += quantidade;
    }
    return { projeto, regionais, total };
  }

  const projetosOficiaisPresentes = ordemProjetos.filter((p) => porProjeto.has(p));
  const resultado = projetosOficiaisPresentes.map(paraContagem);
  if (porProjeto.has(PROJETO_NAO_CLASSIFICADO)) {
    resultado.push(paraContagem(PROJETO_NAO_CLASSIFICADO));
  }
  return resultado;
}

/**
 * Calcula TODOS os indicadores do Dashboard Executivo a partir de uma única
 * consulta ao banco. `where` já deve vir combinado (escopo de acesso por
 * perfil + Filtros Globais do dashboard) — ver `montarWhereDashboard` abaixo,
 * usada por `app/suporte/dashboard/page.tsx`. `agora` é recebido como
 * parâmetro (em vez de `new Date()` direto) só para permitir testar o KPI de
 * SLA de forma determinística, mesmo padrão já usado por
 * `calcularResumo` em lib/exportarAtendimentos.ts.
 */
export async function getIndicadoresExecutivosSuporte(
  where: Prisma.SupportTicketWhereInput = {},
  agora: Date = new Date()
): Promise<IndicadoresExecutivosSuporte> {
  const tickets: TicketParaIndicadores[] = await prisma.supportTicket.findMany({
    where,
    select: {
      status: true,
      resultado: true,
      categoriaPrincipal: true,
      subcategoria: true,
      dataAtendimento: true,
      tempoAtendimento: true,
      tecnicoResponsavel: true,
      createdAt: true,
      updatedAt: true,
      colaborador: { select: { regional: true } },
      projeto: true,
      regional: true,
    },
  });

  const categoriasOficiais = obterCategoriasPrincipais();

  const mapaCategoria = new Map<string, number>();
  const mapaStatusExecutivo = new Map<string, number>(STATUS_EXECUTIVO_OPCOES.map((nome) => [nome, 0]));
  const mapaSubcategoria = new Map<string, number>();
  const mapaTecnico = new Map<string, number>();
  const mapaRegional = new Map<string, number>();
  const mapaEvolucaoDiaria = new Map<string, number>();

  let emAberto = 0;
  let emAtendimento = 0;
  let concluidos = 0;
  let cancelados = 0;

  const temposAtendimento: number[] = [];
  const temposResolucao: number[] = [];
  let chamadosAtrasados = 0;
  let chamadosDentroDoSLA = 0;

  for (const t of tickets) {
    const bucketStatus = statusExecutivo(t.status, t.resultado);
    incrementar(mapaStatusExecutivo, bucketStatus);
    if (bucketStatus === "Aberto") emAberto++;
    else if (bucketStatus === "Em Atendimento") emAtendimento++;
    else if (bucketStatus === "Concluído") concluidos++;
    else cancelados++;

    const categoriaValida = categoriaPrincipalValida(t.categoriaPrincipal);
    incrementar(mapaCategoria, categoriaValida ?? NAO_CLASSIFICADO);

    incrementar(mapaSubcategoria, t.subcategoria?.trim() || SEM_SUBCATEGORIA);
    incrementar(mapaTecnico, t.tecnicoResponsavel?.trim() || TECNICO_NAO_INFORMADO);
    incrementar(mapaRegional, t.colaborador?.regional?.trim() || REGIONAL_NAO_INFORMADA);

    const diaISO = t.dataAtendimento.toISOString().slice(0, 10);
    incrementar(mapaEvolucaoDiaria, diaISO);

    if (typeof t.tempoAtendimento === "number") temposAtendimento.push(t.tempoAtendimento);

    // Tempo Médio de Resolução: aproximado por (updatedAt - createdAt), só
    // para chamados executivamente "Concluído" — mesma técnica de
    // aproximação (updatedAt como proxy de "encerrado em") já usada e
    // documentada em lib/exportarAtendimentos.ts (calcularResumo).
    if (bucketStatus === "Concluído") {
      const minutosResolucao = (t.updatedAt.getTime() - t.createdAt.getTime()) / 60000;
      if (minutosResolucao >= 0) temposResolucao.push(minutosResolucao);
    }

    // SLA: só avaliado sobre chamados ainda em curso (Aberto/Em Atendimento)
    // — um chamado já Concluído ou Cancelado não está "atrasado" no sentido
    // operacional deste KPI (ele já saiu da fila de atendimento).
    if (bucketStatus === "Aberto" || bucketStatus === "Em Atendimento") {
      const horasAberto = (agora.getTime() - t.createdAt.getTime()) / 3_600_000;
      if (horasAberto > SLA_PADRAO_HORAS) chamadosAtrasados++;
      else chamadosDentroDoSLA++;
    }
  }

  const porCategoria = comBucketNaoClassificado(categoriasOficiais, mapaCategoria);

  const porStatusExecutivo: ContagemNome[] = STATUS_EXECUTIVO_OPCOES.map((nome) => ({
    nome,
    quantidade: mapaStatusExecutivo.get(nome) ?? 0,
  }));

  const evolucaoDiaria: PontoEvolucaoDiaria[] = Array.from(mapaEvolucaoDiaria.entries())
    .map(([data, quantidade]) => ({ data, quantidade }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const media = (valores: number[]): number | null =>
    valores.length > 0 ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null;

  return {
    totalChamados: tickets.length,
    emAberto,
    emAtendimento,
    concluidos,
    cancelados,
    porCategoria,
    porStatusExecutivo,
    tempoMedioAtendimentoMinutos: media(temposAtendimento),
    tempoMedioResolucaoMinutos: media(temposResolucao),
    chamadosAtrasados,
    chamadosDentroDoSLA,
    topCategorias: ordenarDesc(mapaCategoria).slice(0, TAMANHO_TOP),
    topSubcategorias: ordenarDesc(mapaSubcategoria).slice(0, TAMANHO_TOP),
    topTecnicos: ordenarDesc(mapaTecnico).slice(0, TAMANHO_TOP),
    topRegionais: ordenarDesc(mapaRegional).slice(0, TAMANHO_TOP),
    evolucaoDiaria,
    chamadosPorProjetoRegional: calcularChamadosPorProjetoRegional(tickets),
  };
}

// ---------------------------------------------------------------------------
// FILTROS GLOBAIS (revisão "Centro de Controle Operacional")
// ---------------------------------------------------------------------------

export const PERIODOS_DASHBOARD = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7dias", rotulo: "Últimos 7 dias" },
  { valor: "30dias", rotulo: "Últimos 30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "personalizado", rotulo: "Personalizado" },
  { valor: "todos", rotulo: "Todos" },
] as const;

export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number]["valor"];

/** Período padrão na primeira carga da página (sem nenhum parâmetro na URL). "Todos" evita uma tela vazia caso a base de teste só tenha atendimentos fora dos últimos 30 dias. */
export const PERIODO_PADRAO: PeriodoDashboard = "todos";

export type FiltrosDashboardExecutivo = {
  /** Categoria Principal da hierarquia de categorias (ver lib/categoriasSuporte.ts). Missão v7.3: o filtro por Projeto/Fabricante foi removido — não existe mais nível de Projeto nesta hierarquia. */
  categoria?: string;
  /** Bucket executivo — ver `StatusExecutivo` acima. */
  statusExecutivo?: string;
  regional?: string;
  tecnico?: string;
  periodo?: string;
  dataInicioPersonalizada?: string;
  dataFimPersonalizada?: string;
};

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Resolve o filtro "Período" em um intervalo concreto de datas
 * (`dataInicio`/`dataFim`, formato YYYY-MM-DD, mesmo formato que
 * `buildWhereSuporte` — lib/suporte.ts — já espera). `agora` é parâmetro
 * explícito para testabilidade determinística.
 */
export function resolverPeriodo(
  periodo: string | undefined,
  dataInicioPersonalizada: string | undefined,
  dataFimPersonalizada: string | undefined,
  agora: Date = new Date()
): { dataInicio?: string; dataFim?: string } {
  const hojeIso = paraIso(agora);

  switch (periodo) {
    case "hoje":
      return { dataInicio: hojeIso, dataFim: hojeIso };
    case "7dias": {
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 6);
      return { dataInicio: paraIso(inicio), dataFim: hojeIso };
    }
    case "30dias": {
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 29);
      return { dataInicio: paraIso(inicio), dataFim: hojeIso };
    }
    case "mes": {
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      return { dataInicio: paraIso(inicio), dataFim: hojeIso };
    }
    case "personalizado":
      return { dataInicio: dataInicioPersonalizada || undefined, dataFim: dataFimPersonalizada || undefined };
    case "todos":
      return {};
    default:
      return resolverPeriodo(PERIODO_PADRAO, undefined, undefined, agora);
  }
}

/**
 * Traduz o bucket executivo de status (Aberto/Em Atendimento/Concluído/
 * Cancelado) na cláusula `where` correspondente do Prisma. "Concluído" exclui
 * explicitamente `resultado: "Cancelado"` porque um chamado com `status`
 * "Finalizado" mas `resultado` "Cancelado" conta como "Cancelado" no
 * dashboard (mesma prioridade de `statusExecutivo` acima) — sem essa
 * exclusão, o filtro global "Concluído" incluiria chamados que o próprio
 * dashboard classifica e mostra como "Cancelado".
 */
export function construirClausulaStatusExecutivo(statusExecutivo: string | undefined): Prisma.SupportTicketWhereInput {
  switch (statusExecutivo) {
    case "Cancelado":
      return { resultado: "Cancelado" };
    case "Concluído":
      return { status: "Finalizado", NOT: { resultado: "Cancelado" } };
    case "Em Atendimento":
      return { status: "Em Atendimento", NOT: { resultado: "Cancelado" } };
    case "Aberto":
      return { status: "Aberto", NOT: { resultado: "Cancelado" } };
    default:
      return {};
  }
}

/** Filtro Global "Regional" — via relação com Colaborador (campo texto livre, sem enum — ver lib/colaboradores.ts). */
export function construirClausulaRegional(regional: string | undefined): Prisma.SupportTicketWhereInput {
  if (!regional) return {};
  return { colaborador: { regional: { equals: regional, mode: "insensitive" } } };
}

/**
 * Monta o `where` combinado (escopo de acesso + Filtros Globais) usado pela
 * única consulta de `getIndicadoresExecutivosSuporte`. Reaproveita
 * `buildWhereSuporte` (lib/suporte.ts, não alterado em seu comportamento
 * existente) para Projeto/Categoria/Técnico/Período — só Status executivo e
 * Regional têm cláusulas próprias, por serem conceitos que não existem em
 * `FiltrosSuporte`.
 */
export function montarWhereDashboard(
  escopo: Prisma.SupportTicketWhereInput,
  filtros: FiltrosDashboardExecutivo,
  agora: Date = new Date()
): Prisma.SupportTicketWhereInput {
  const { dataInicio, dataFim } = resolverPeriodo(
    filtros.periodo,
    filtros.dataInicioPersonalizada,
    filtros.dataFimPersonalizada,
    agora
  );

  return {
    AND: [
      escopo,
      buildWhereSuporte({
        categoriaPrincipal: filtros.categoria,
        tecnico: filtros.tecnico,
        dataInicio,
        dataFim,
      }),
      construirClausulaStatusExecutivo(filtros.statusExecutivo),
      construirClausulaRegional(filtros.regional),
    ],
  };
}

/** Distinct de Regional cadastrada em Colaborador, para popular o `<select>` do filtro global — ver nota de performance no topo do arquivo. */
export async function obterRegionaisDisponiveis(): Promise<string[]> {
  const linhas = await prisma.colaborador.findMany({
    where: { regional: { not: null } },
    select: { regional: true },
    distinct: ["regional"],
    orderBy: { regional: "asc" },
  });
  return linhas.map((l) => l.regional).filter((r): r is string => !!r && r.trim() !== "");
}

// ---------------------------------------------------------------------------
// DRILL DOWN — construção pura de URLs para /suporte (listagem), a partir de
// um card/gráfico/ranking clicado, combinando os Filtros Globais ativos no
// momento do clique com a dimensão específica clicada.
// ---------------------------------------------------------------------------

/** Traduz o bucket executivo de status nos parâmetros que /suporte (listagem) já entende (`status` cru ou `resultado`). */
export function mapearStatusExecutivoParaParametrosSuporte(
  statusExecutivo: string | undefined
): { status?: string; resultado?: string } {
  switch (statusExecutivo) {
    case "Cancelado":
      return { resultado: "Cancelado" };
    case "Concluído":
      return { status: "Finalizado" };
    case "Em Atendimento":
      return { status: "Em Atendimento" };
    case "Aberto":
      return { status: "Aberto" };
    default:
      return {};
  }
}

/**
 * Monta a query string de `/suporte` a partir de uma base de parâmetros (os
 * Filtros Globais atualmente ativos, já traduzidos) combinada com os
 * parâmetros extras da dimensão específica clicada (ex.: `{ categoria_projeto:
 * "NOKIA" }`). `extra` sempre tem prioridade sobre `base` para a mesma chave.
 * Parâmetros com valor `undefined`/vazio são omitidos. Função pura — sem
 * nenhuma chamada ao banco — para ser testável isoladamente.
 */
export function montarHrefDrillDown(
  base: Record<string, string | undefined>,
  extra: Record<string, string | undefined> = {}
): string {
  const combinado = { ...base, ...extra };
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(combinado)) {
    if (valor) params.set(chave, valor);
  }
  const query = params.toString();
  return query ? `/suporte?${query}` : "/suporte";
}

// ---------------------------------------------------------------------------
// "ÚLTIMA ATUALIZAÇÃO" (Sprint v7.2 — ÚLTIMA REVISÃO) — formatação pt-BR do
// horário em que os dados foram carregados no servidor. Funções puras
// (recebem `data`/`fusoHorario` como parâmetro, nunca chamam `new Date()`
// internamente) para serem testáveis de forma determinística — a página
// (Server Component) calcula `new Date()` uma única vez por requisição e
// repassa o mesmo instante tanto para estas funções quanto para
// `getIndicadoresExecutivosSuporte` (parâmetro `agora`, KPI de SLA), evitando
// qualquer divergência de poucos milissegundos entre o texto exibido e o
// cálculo do SLA.
// ---------------------------------------------------------------------------

export const FUSO_HORARIO_PADRAO = "America/Sao_Paulo";

/** "14:37:22" — usa Intl.DateTimeFormat (nativo, sem nenhuma dependência nova) com o fuso horário explícito, nunca o fuso do processo do servidor. */
export function formatarHoraBrasil(data: Date, fusoHorario: string = FUSO_HORARIO_PADRAO): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoHorario,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(data);
}

/** "23/07/2026 às 14:37:22" — data + hora, mesmo fuso horário de `formatarHoraBrasil`. */
export function formatarDataHoraBrasil(data: Date, fusoHorario: string = FUSO_HORARIO_PADRAO): string {
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoHorario,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
  return `${dataFormatada} às ${formatarHoraBrasil(data, fusoHorario)}`;
}

/**
 * Reconstrói a query string atual a partir de um objeto `searchParams` de
 * Server Component (`{ [chave]: string | string[] | undefined }`) — usada
 * pelo botão "Atualizar Dashboard" (`app/suporte/dashboard/page.tsx`) para
 * navegar para a própria URL preservando EXATAMENTE os filtros ativos, sem
 * precisar conhecer cada filtro individualmente (ao contrário de
 * `montarHrefDrillDown`, que monta a URL de destino a partir de valores já
 * resolvidos, esta função só serializa de volta o que já está na URL atual).
 * Função pura — testável isoladamente.
 */
export function construirQueryStringAtual(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(searchParams)) {
    if (Array.isArray(valor)) {
      valor.forEach((v) => params.append(chave, v));
    } else if (valor !== undefined) {
      params.set(chave, valor);
    }
  }
  return params.toString();
}
