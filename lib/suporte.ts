import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { obterRotuloCategoriaExibicao } from "@/lib/categoriasSuporte";

/**
 * Motor de indicadores da CENTRAL DE SUPORTE TÉCNICO.
 *
 * Centraliza constantes de domínio (tipos de atendimento, categorias,
 * resultados, status), o cálculo automático de tempo de atendimento e
 * todos os indicadores agregados (KPIs do topo da página /suporte,
 * top categorias/equipes/líderes, % resolvido na primeira intervenção
 * etc). Tudo deriva da tabela SupportTicket via Prisma — nenhuma tabela
 * adicional é necessária.
 *
 * Esta camada foi desenhada para também alimentar, no futuro, uma rotina
 * de IA operacional (perguntas como "qual equipe gera mais suporte?"),
 * já que os indicadores abaixo são exatamente as respostas para esse
 * tipo de pergunta.
 */

export const TIPOS_ATENDIMENTO = [
  "Telefone",
  "WhatsApp",
  "Videochamada",
  "Acesso Remoto",
  "Presencial",
  "Teams",
  "Outro",
] as const;

export const CATEGORIAS_SUPORTE = [
  "MOS",
  "XML",
  "TESTE TX",
  "SWAP",
  "FAM",
  "REVERSA",
  "Infraestrutura",
  "Energia",
  "Fibra Óptica",
  "Alarmes",
  "Configuração",
  "Software",
  "Hardware",
  "Outro",
] as const;

export const RESULTADOS_SUPORTE = [
  "Resolvido",
  "Resolvido Parcialmente",
  "Encaminhado Engenharia",
  "Aguardando Cliente",
  "Aguardando Material",
  "Cancelado",
] as const;

export const STATUS_SUPORTE = ["Aberto", "Em Atendimento", "Finalizado"] as const;

export type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];
export type CategoriaSuporte = (typeof CATEGORIAS_SUPORTE)[number];
export type ResultadoSuporte = (typeof RESULTADOS_SUPORTE)[number];
export type StatusSuporte = (typeof STATUS_SUPORTE)[number];

/**
 * Calcula o tempo de atendimento em minutos a partir de duas strings
 * "HH:mm". Se a hora de término for menor que a de início, assume que o
 * atendimento cruzou a meia-noite (soma 24h). Retorna null se faltar
 * qualquer uma das duas horas ou se o formato for inválido.
 */
export function calcularTempoAtendimento(
  horaInicio: string | null | undefined,
  horaFim: string | null | undefined
): number | null {
  if (!horaInicio || !horaFim) return null;

  const partes = /^(\d{1,2}):(\d{2})$/;
  const mInicio = horaInicio.match(partes);
  const mFim = horaFim.match(partes);
  if (!mInicio || !mFim) return null;

  const minutosInicio = Number(mInicio[1]) * 60 + Number(mInicio[2]);
  const minutosFim = Number(mFim[1]) * 60 + Number(mFim[2]);

  let diferenca = minutosFim - minutosInicio;
  if (diferenca < 0) diferenca += 24 * 60;

  return diferenca;
}

/** Limite de tamanho do campo Site — mesmo valor usado no formulário (`maxLength`) e aqui, na normalização do servidor. */
export const TAMANHO_MAXIMO_SITE = 30;

/**
 * Normaliza o valor digitado do campo Site (ex.: "sn-aqdik4" → "SN-AQDIK4"):
 * remove espaços nas pontas, converte para maiúsculas, mantém apenas
 * letras/números/hífen (descarta qualquer outro caractere silenciosamente,
 * em vez de rejeitar o formulário inteiro) e limita a `TAMANHO_MAXIMO_SITE`
 * caracteres. Retorna `null` quando vazio (ou quando só sobrarem caracteres
 * inválidos) — o campo é opcional, e `null` é o valor salvo para
 * atendimentos antigos ou administrativos sem site associado.
 */
export function normalizarSite(valorBruto: string | null | undefined): string | null {
  const semEspacosNasPontas = (valorBruto ?? "").trim();
  if (!semEspacosNasPontas) return null;

  const apenasValidos = semEspacosNasPontas.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!apenasValidos) return null;

  return apenasValidos.slice(0, TAMANHO_MAXIMO_SITE);
}

export type KpisSuporte = {
  atendimentosHoje: number;
  atendimentosMes: number;
  tempoMedioMinutos: number | null;
  resolvidosHoje: number;
  pendentes: number;
};

function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

/**
 * KPIs exibidos no topo da página /suporte.
 *
 * `escopo` é a cláusula de acesso por perfil (ver
 * `criarFiltroDeAcessoAtendimentos` em lib/autorizacao.ts) — combinada via
 * AND em CADA uma das 5 consultas abaixo, para que os totais de um TECNICO
 * reflitam somente os atendimentos dele, nunca a base inteira. Chamador
 * nunca deve omitir o escopo em produção; o padrão `{}` (sem restrição)
 * existe só para não quebrar chamadas que já tinham o escopo global (ADMIN).
 */
export async function getKpisSuporte(
  escopo: Prisma.SupportTicketWhereInput = {}
): Promise<KpisSuporte> {
  const agora = new Date();
  const hoje = inicioDoDia(agora);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const mesAtual = inicioDoMes(agora);

  const [atendimentosHoje, atendimentosMes, tempoMedioAgg, resolvidosHoje, pendentes] =
    await Promise.all([
      prisma.supportTicket.count({
        where: { AND: [escopo, { dataAtendimento: { gte: hoje, lt: amanha } }] },
      }),
      prisma.supportTicket.count({
        where: { AND: [escopo, { dataAtendimento: { gte: mesAtual } }] },
      }),
      prisma.supportTicket.aggregate({
        where: escopo,
        _avg: { tempoAtendimento: true },
      }),
      prisma.supportTicket.count({
        where: {
          AND: [
            escopo,
            { dataAtendimento: { gte: hoje, lt: amanha }, resultado: "Resolvido" },
          ],
        },
      }),
      prisma.supportTicket.count({
        where: { AND: [escopo, { status: { not: "Finalizado" } }] },
      }),
    ]);

  return {
    atendimentosHoje,
    atendimentosMes,
    tempoMedioMinutos: tempoMedioAgg._avg.tempoAtendimento,
    resolvidosHoje,
    pendentes,
  };
}

export type FiltrosSuporte = {
  dataInicio?: string;
  dataFim?: string;
  colaboradorId?: number;
  projeto?: string;
  categoria?: string;
  categoriaPrincipal?: string;
  subcategoria?: string;
  detalhamento?: string;
  status?: string;
  tecnico?: string;
  site?: string;
  busca?: string;
  /**
   * Sprint v7.2 — REVISÃO ("Centro de Controle Operacional"). Acréscimo
   * puramente aditivo, sem nenhum novo `<input>`/`<select>` visível no
   * formulário de /suporte (que já está grande e homologado) — alcançável só
   * via URL, principalmente a partir dos links de drill-down do Dashboard
   * Executivo (ver lib/dashboardSuporte.ts). Mirrors o mesmo padrão de
   * `status` (match exato).
   */
  resultado?: string;
  /**
   * Idem acima: acréscimo aditivo, só alcançável via URL/drill-down. Regional
   * é um campo de texto livre do Colaborador (sem enum — ver
   * lib/colaboradores.ts), por isso o match é `equals` case-insensitive
   * (mesmo valor exato que já aparece nos agrupamentos do dashboard).
   */
  regional?: string;
};

/** Monta a cláusula `where` do Prisma a partir dos filtros/busca da tela de listagem e de relatórios. */
export function buildWhereSuporte(filtros: FiltrosSuporte): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = {};
  const and: Prisma.SupportTicketWhereInput[] = [];

  if (filtros.dataInicio || filtros.dataFim) {
    const range: { gte?: Date; lte?: Date } = {};
    if (filtros.dataInicio) range.gte = new Date(filtros.dataInicio);
    if (filtros.dataFim) {
      const fim = new Date(filtros.dataFim);
      fim.setHours(23, 59, 59, 999);
      range.lte = fim;
    }
    and.push({ dataAtendimento: range });
  }

  if (filtros.colaboradorId) and.push({ colaboradorId: filtros.colaboradorId });
  if (filtros.projeto) and.push({ projeto: { contains: filtros.projeto, mode: "insensitive" } });
  if (filtros.categoria) and.push({ categoria: filtros.categoria });

  // Classificação hierárquica: um atendimento novo é encontrado pelo campo
  // estruturado correspondente; um atendimento antigo (só com `categoria`
  // legado, ou classificado por uma matriz anterior com Projeto embutido —
  // ex.: "NOKIA > MOS", formato usado até a missão passada) é encontrado por
  // busca textual (contains, case-insensitive) no mesmo termo — assim o
  // filtro funciona igual para os dois tipos de registro, sem exigir que o
  // usuário saiba se o atendimento é antigo ou novo.
  //
  // Missão "Refatoração da Categoria do Atendimento — eliminação do campo
  // Projeto duplicado" (v7.3): não existe mais nível de Projeto na
  // hierarquia de categorias (ver lib/categoriasSuporte.ts) — o filtro por
  // Projeto por Fabricante foi removido daqui (decisão explícita do
  // usuário). `categoriaPrincipal` agora grava o nome da Categoria Principal
  // diretamente, sem prefixo — por isso o match estrutural é sempre exato.
  if (filtros.categoriaPrincipal) {
    and.push({
      OR: [
        { categoriaPrincipal: filtros.categoriaPrincipal },
        { categoria: { contains: filtros.categoriaPrincipal, mode: "insensitive" } },
      ],
    });
  }
  if (filtros.subcategoria) {
    and.push({
      OR: [
        { subcategoria: filtros.subcategoria },
        { categoria: { contains: filtros.subcategoria, mode: "insensitive" } },
      ],
    });
  }
  if (filtros.detalhamento) {
    and.push({
      OR: [
        { detalhamento: filtros.detalhamento },
        { categoria: { contains: filtros.detalhamento, mode: "insensitive" } },
      ],
    });
  }

  if (filtros.status) and.push({ status: filtros.status });
  if (filtros.tecnico) {
    and.push({ tecnicoResponsavel: { contains: filtros.tecnico, mode: "insensitive" } });
  }
  // Busca parcial e sem diferenciar maiúsculas/minúsculas: "AQDIK4" encontra
  // "SN-AQDIK4", "SN-AQD" encontra qualquer site que contenha esse trecho.
  if (filtros.site) and.push({ site: { contains: filtros.site, mode: "insensitive" } });
  // Sprint v7.2 — REVISÃO: campos aditivos (ver comentário no tipo acima).
  if (filtros.resultado) and.push({ resultado: filtros.resultado });
  if (filtros.regional) {
    and.push({ colaborador: { regional: { equals: filtros.regional, mode: "insensitive" } } });
  }

  if (filtros.busca) {
    const termo = filtros.busca.trim();
    const numeroBusca = Number(termo);
    and.push({
      OR: [
        { colaborador: { nome: { contains: termo, mode: "insensitive" } } },
        { projeto: { contains: termo, mode: "insensitive" } },
        { categoria: { contains: termo, mode: "insensitive" } },
        ...(Number.isFinite(numeroBusca) && termo !== "" ? [{ numero: numeroBusca }] : []),
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export type ContagemNome = { nome: string; quantidade: number };

export type IndicadoresSuporte = {
  totalAtendimentos: number;
  porColaborador: ContagemNome[];
  porProjeto: ContagemNome[];
  tempoMedioGeral: number | null;
  tempoMedioPorCategoria: { categoria: string; tempoMedio: number }[];
  topCategorias: ContagemNome[];
  topColaboradores: ContagemNome[];
  percentualResolvidoPrimeiraIntervencao: number;
  pendenciasAbertas: number;
};

/**
 * Indicadores automáticos usados no dashboard local de /suporte e em
 * /relatorios/suporte. Todos calculados sobre o conjunto de tickets que
 * atende aos filtros informados (sem filtro = toda a base) E ao `escopo` de
 * acesso do usuário (ver `criarFiltroDeAcessoAtendimentos` em
 * lib/autorizacao.ts) — para um TECNICO, todos os totais/agrupamentos/
 * rankings abaixo consideram somente os próprios atendimentos, nunca a base
 * inteira. `escopo` default `{}` (sem restrição) só para não quebrar
 * chamadas já existentes com escopo global (ADMIN).
 */
export async function getIndicadoresSuporte(
  filtros: FiltrosSuporte = {},
  escopo: Prisma.SupportTicketWhereInput = {}
): Promise<IndicadoresSuporte> {
  const where: Prisma.SupportTicketWhereInput = { AND: [escopo, buildWhereSuporte(filtros)] };

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: { colaborador: true },
  });

  const totalAtendimentos = tickets.length;

  const contarPor = (chave: (t: (typeof tickets)[number]) => string | null): ContagemNome[] => {
    const mapa = new Map<string, number>();
    for (const t of tickets) {
      const nome = chave(t);
      if (!nome) continue;
      mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
    }
    return Array.from(mapa.entries())
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  const porColaborador = contarPor((t) => t.colaborador?.nome ?? null);
  const porProjeto = contarPor((t) => t.projeto);
  const porCategoria = contarPor((t) => t.categoria);

  const temposValidos = tickets
    .map((t) => t.tempoAtendimento)
    .filter((v): v is number => v !== null && v !== undefined);
  const tempoMedioGeral =
    temposValidos.length > 0
      ? temposValidos.reduce((soma, v) => soma + v, 0) / temposValidos.length
      : null;

  const temposPorCategoria = new Map<string, number[]>();
  for (const t of tickets) {
    if (t.tempoAtendimento === null || t.tempoAtendimento === undefined) continue;
    const lista = temposPorCategoria.get(t.categoria) ?? [];
    lista.push(t.tempoAtendimento);
    temposPorCategoria.set(t.categoria, lista);
  }
  const tempoMedioPorCategoria = Array.from(temposPorCategoria.entries())
    .map(([categoria, tempos]) => ({
      categoria,
      tempoMedio: tempos.reduce((soma, v) => soma + v, 0) / tempos.length,
    }))
    .sort((a, b) => b.tempoMedio - a.tempoMedio);

  // "Resolvido na primeira intervenção" = resultado "Resolvido" (não
  // "Resolvido Parcialmente"/"Encaminhado Engenharia"/etc). Como o modelo
  // atual não guarda reaberturas explicitamente, cada ticket é, por
  // padrão, considerado uma única intervenção.
  const totalComResultado = tickets.filter((t) => t.resultado).length;
  const resolvidosOk = tickets.filter((t) => t.resultado === "Resolvido").length;
  const percentualResolvidoPrimeiraIntervencao =
    totalComResultado > 0 ? Math.round((resolvidosOk / totalComResultado) * 100) : 0;

  const pendenciasAbertas = tickets.filter((t) => t.status !== "Finalizado").length;

  return {
    totalAtendimentos,
    porColaborador,
    porProjeto,
    tempoMedioGeral,
    tempoMedioPorCategoria,
    topCategorias: porCategoria.slice(0, 5),
    topColaboradores: porColaborador.slice(0, 5),
    percentualResolvidoPrimeiraIntervencao,
    pendenciasAbertas,
  };
}

/**
 * Formata minutos em um rótulo curto ("45 min", "1h30min", "2h"). Usada em
 * todas as telas que exibem tempo de atendimento — centralizada aqui para
 * não ter uma cópia local em cada página (eram 4 cópias idênticas antes do
 * redesign visual da V6).
 */
export function formatarTempo(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return resto > 0 ? `${horas}h${resto}min` : `${horas}h`;
}

export type TicketResumo = {
  id: number;
  numero: number;
  dataAtendimento: string;
  colaboradorNome: string | null;
  projeto: string | null;
  categoria: string;
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
  /** Texto pronto para exibição: hierárquico se disponível, senão o `categoria` legado. */
  categoriaExibicao: string;
  tempoAtendimento: number | null;
  resultado: string;
  status: string;
};

/**
 * Últimos atendimentos registrados, para o card "Últimos atendimentos".
 * `escopo` (ver lib/autorizacao.ts) é aplicado na própria consulta — para um
 * TECNICO, o `take: limite` nunca "rouba" uma vaga de atendimento de outro
 * usuário: a limitação e o escopo são combinados na mesma consulta, nunca
 * filtrados depois de carregado.
 */
export async function getUltimosAtendimentos(
  limite = 5,
  escopo: Prisma.SupportTicketWhereInput = {}
): Promise<TicketResumo[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: escopo,
    include: { colaborador: true },
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  return tickets.map((t) => ({
    id: t.id,
    numero: t.numero,
    dataAtendimento: t.dataAtendimento.toISOString().slice(0, 10),
    colaboradorNome: t.colaborador?.nome ?? null,
    projeto: t.projeto,
    categoria: t.categoria,
    categoriaPrincipal: t.categoriaPrincipal,
    subcategoria: t.subcategoria,
    detalhamento: t.detalhamento,
    categoriaExibicao: obterRotuloCategoriaExibicao(t),
    tempoAtendimento: t.tempoAtendimento,
    resultado: t.resultado,
    status: t.status,
  }));
}
