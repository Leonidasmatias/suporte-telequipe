import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

/** KPIs exibidos no topo da página /suporte. */
export async function getKpisSuporte(): Promise<KpisSuporte> {
  const agora = new Date();
  const hoje = inicioDoDia(agora);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const mesAtual = inicioDoMes(agora);

  const [atendimentosHoje, atendimentosMes, tempoMedioAgg, resolvidosHoje, pendentes] =
    await Promise.all([
      prisma.supportTicket.count({
        where: { dataAtendimento: { gte: hoje, lt: amanha } },
      }),
      prisma.supportTicket.count({
        where: { dataAtendimento: { gte: mesAtual } },
      }),
      prisma.supportTicket.aggregate({
        _avg: { tempoAtendimento: true },
      }),
      prisma.supportTicket.count({
        where: {
          dataAtendimento: { gte: hoje, lt: amanha },
          resultado: "Resolvido",
        },
      }),
      prisma.supportTicket.count({
        where: { status: { not: "Finalizado" } },
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
  status?: string;
  tecnico?: string;
  busca?: string;
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
  if (filtros.status) and.push({ status: filtros.status });
  if (filtros.tecnico) {
    and.push({ tecnicoResponsavel: { contains: filtros.tecnico, mode: "insensitive" } });
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
 * atende aos filtros informados (sem filtro = toda a base).
 */
export async function getIndicadoresSuporte(filtros: FiltrosSuporte = {}): Promise<IndicadoresSuporte> {
  const where = buildWhereSuporte(filtros);

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
  tempoAtendimento: number | null;
  resultado: string;
  status: string;
};

/** Últimos atendimentos registrados, para o card "Últimos atendimentos". */
export async function getUltimosAtendimentos(limite = 5): Promise<TicketResumo[]> {
  const tickets = await prisma.supportTicket.findMany({
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
    tempoAtendimento: t.tempoAtendimento,
    resultado: t.resultado,
    status: t.status,
  }));
}
