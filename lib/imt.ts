import { prisma } from "@/lib/prisma";

/**
 * Motor de inteligência operacional do SUPORTE TELEQUIPE.
 *
 * Centraliza todo o cálculo de IMT (Índice de Maturidade Técnica):
 * gargalo operacional, ranking, tendência temporal e sugestões
 * automáticas de treinamento. Tudo é derivado das avaliações
 * registradas em AvaliacaoCompetencia via Prisma — o histórico de
 * avaliações já é a série temporal, nenhuma tabela adicional é necessária.
 *
 * V3: portado de consultas SQL cruas (better-sqlite3) para Prisma Client.
 * Todas as funções que acessam o banco agora são assíncronas.
 */

export const LIMIAR_ALERTA = 70;

export const ETAPAS = [
  { codigo: "MOS", nome: "MOS — Mobilização de Site" },
  { codigo: "XML", nome: "XML — Configuração de Dados" },
  { codigo: "TX", nome: "TX — Transmissão" },
  { codigo: "SWAP", nome: "SWAP — Troca de Equipamento" },
  { codigo: "FAM", nome: "FAM — Familiarização Técnica" },
  { codigo: "REVERSA", nome: "REVERSA — Logística Reversa" },
] as const;

export type EtapaCodigo = (typeof ETAPAS)[number]["codigo"];

export const NOME_ETAPA: Record<EtapaCodigo, string> = Object.fromEntries(
  ETAPAS.map((e) => [e.codigo, e.nome])
) as Record<EtapaCodigo, string>;

export const TREINAMENTO_SUGERIDO: Record<EtapaCodigo, string> = {
  MOS: "Reforço técnico em Mobilização de Site (MOS)",
  XML: "Reforço técnico em Configuração de Dados (XML)",
  TX: "Reforço técnico em Transmissão (TX)",
  SWAP: "Reforço técnico em Troca de Equipamentos Nokia (SWAP)",
  FAM: "Reforço técnico em Familiarização Técnica (FAM)",
  REVERSA: "Reforço técnico em Logística Reversa (REVERSA)",
};

export type Tendencia = "subindo" | "estavel" | "caindo" | "indefinido";

export type AvaliacaoRow = {
  id: number;
  colaboradorId: number;
  colaboradorNome: string;
  etapa: EtapaCodigo;
  nivel: string;
  imtScore: number;
  dataAvaliacao: string | null;
  createdAt: string;
};

/** Busca todas as avaliações da matriz Nokia, já com o colaborador, ordenadas por data. */
export async function getAvaliacoes(): Promise<AvaliacaoRow[]> {
  const rows = await prisma.avaliacaoCompetencia.findMany({
    include: {
      colaborador: true,
      competencia: true,
    },
  });

  const mapeadas: AvaliacaoRow[] = rows.map((r) => ({
    id: r.id,
    colaboradorId: r.colaboradorId,
    colaboradorNome: r.colaborador.nome,
    etapa: r.competencia.nome as EtapaCodigo,
    nivel: r.nivel,
    imtScore: r.nota,
    dataAvaliacao: r.avaliadoEm ? r.avaliadoEm.toISOString().slice(0, 10) : null,
    createdAt: r.createdAt.toISOString(),
  }));

  // Ordena por data (avaliadoEm, com fallback para createdAt) — equivalente ao
  // "ORDER BY COALESCE(data_avaliacao, created_at) ASC" da versão SQLite.
  mapeadas.sort((a, b) => {
    const chaveA = a.dataAvaliacao ?? a.createdAt;
    const chaveB = b.dataAvaliacao ?? b.createdAt;
    return chaveA.localeCompare(chaveB) || a.id - b.id;
  });

  return mapeadas;
}

export function media(numeros: number[]): number {
  if (numeros.length === 0) return 0;
  return numeros.reduce((soma, n) => soma + n, 0) / numeros.length;
}

export function desvioPadrao(numeros: number[]): number {
  if (numeros.length < 2) return 0;
  const m = media(numeros);
  const variancia = numeros.reduce((acc, n) => acc + (n - m) ** 2, 0) / numeros.length;
  return Math.sqrt(variancia);
}

/**
 * Compara a média da metade mais recente da série com a metade mais antiga.
 * Diferença > 3 pontos: subindo. < -3 pontos: caindo. Caso contrário: estável.
 * Requer ao menos 2 avaliações; caso contrário, tendência é "indefinido".
 */
export function calcularTendencia(scoresOrdenadosPorData: number[]): Tendencia {
  if (scoresOrdenadosPorData.length < 2) return "indefinido";
  const metade = Math.max(1, Math.floor(scoresOrdenadosPorData.length / 2));
  const antigos = scoresOrdenadosPorData.slice(0, metade);
  const recentes = scoresOrdenadosPorData.slice(-metade);
  const diferenca = media(recentes) - media(antigos);
  if (diferenca > 3) return "subindo";
  if (diferenca < -3) return "caindo";
  return "estavel";
}

export type EtapaResumo = { etapa: EtapaCodigo; media: number; qtd: number };

export type ColaboradorInsight = {
  id: number;
  nome: string;
  mediaGeral: number;
  consistencia: number;
  rankingScore: number;
  tendencia: Tendencia;
  etapas: EtapaResumo[];
  etapasSemAvaliacao: EtapaCodigo[];
  gargalo: EtapaResumo | null;
};

function agruparPorEtapa(avaliacoes: AvaliacaoRow[]): Map<EtapaCodigo, number[]> {
  const mapa = new Map<EtapaCodigo, number[]>();
  for (const av of avaliacoes) {
    const lista = mapa.get(av.etapa) ?? [];
    lista.push(av.imtScore);
    mapa.set(av.etapa, lista);
  }
  return mapa;
}

function calcularGargalo(porEtapa: Map<EtapaCodigo, number[]>): {
  resumos: EtapaResumo[];
  semAvaliacao: EtapaCodigo[];
  gargalo: EtapaResumo | null;
} {
  const resumos: EtapaResumo[] = ETAPAS.filter((e) => porEtapa.has(e.codigo)).map((e) => ({
    etapa: e.codigo,
    media: media(porEtapa.get(e.codigo)!),
    qtd: porEtapa.get(e.codigo)!.length,
  }));
  const semAvaliacao = ETAPAS.map((e) => e.codigo).filter((codigo) => !porEtapa.has(codigo));

  let gargalo: EtapaResumo | null = null;
  if (resumos.length > 0) {
    gargalo = resumos.reduce((pior, atual) => (atual.media < pior.media ? atual : pior), resumos[0]);
  }

  return { resumos, semAvaliacao, gargalo };
}

/** Ranking + gargalo + tendência por colaborador (ordenado do melhor para o pior ranking). */
export async function buildColaboradorInsights(): Promise<ColaboradorInsight[]> {
  const avaliacoes = await getAvaliacoes();
  const porColaborador = new Map<number, AvaliacaoRow[]>();
  for (const av of avaliacoes) {
    const lista = porColaborador.get(av.colaboradorId) ?? [];
    lista.push(av);
    porColaborador.set(av.colaboradorId, lista);
  }

  const insights: ColaboradorInsight[] = [];
  for (const [colaboradorId, avals] of porColaborador) {
    const scores = avals.map((a) => a.imtScore);
    const mediaGeral = media(scores);
    const consistencia = Math.max(0, Math.round(100 - desvioPadrao(scores)));
    const rankingScore = Math.round(mediaGeral * 0.7 + consistencia * 0.3);
    const tendencia = calcularTendencia(avals.map((a) => a.imtScore));

    const porEtapa = agruparPorEtapa(avals);
    const { resumos, semAvaliacao, gargalo } = calcularGargalo(porEtapa);

    insights.push({
      id: colaboradorId,
      nome: avals[0].colaboradorNome,
      mediaGeral,
      consistencia,
      rankingScore,
      tendencia,
      etapas: resumos,
      etapasSemAvaliacao: semAvaliacao,
      gargalo,
    });
  }

  return insights.sort((a, b) => b.rankingScore - a.rankingScore);
}

export type Alerta = {
  etapa: EtapaCodigo;
  etapaNome: string;
  quantidade: number;
  colaboradores: { nome: string; media: number }[];
};

/** Alertas automáticos: colaboradores com média abaixo do limiar em cada etapa Nokia. */
export function buildAlertas(colaboradores: ColaboradorInsight[]): Alerta[] {
  const porEtapa = new Map<EtapaCodigo, { nome: string; media: number }[]>();

  for (const c of colaboradores) {
    for (const e of c.etapas) {
      if (e.media < LIMIAR_ALERTA) {
        const lista = porEtapa.get(e.etapa) ?? [];
        lista.push({ nome: c.nome, media: e.media });
        porEtapa.set(e.etapa, lista);
      }
    }
  }

  const alertas: Alerta[] = [];
  for (const etapaDef of ETAPAS) {
    const lista = porEtapa.get(etapaDef.codigo);
    if (lista && lista.length > 0) {
      alertas.push({
        etapa: etapaDef.codigo,
        etapaNome: etapaDef.nome,
        quantidade: lista.length,
        colaboradores: lista.sort((a, b) => a.media - b.media),
      });
    }
  }
  return alertas.sort((a, b) => b.quantidade - a.quantidade);
}

export type SugestaoTreinamento = {
  colaborador_id: number;
  colaborador_nome: string;
  etapa: EtapaCodigo;
  etapaNome: string;
  media: number;
  treinamentoSugerido: string;
};

/** Se o IMT de uma etapa está abaixo do limiar, sugere treinamento automático para aquela etapa. */
export function buildSugestoesTreinamento(colaboradores: ColaboradorInsight[]): SugestaoTreinamento[] {
  const sugestoes: SugestaoTreinamento[] = [];

  for (const c of colaboradores) {
    for (const e of c.etapas) {
      if (e.media < LIMIAR_ALERTA) {
        sugestoes.push({
          colaborador_id: c.id,
          colaborador_nome: c.nome,
          etapa: e.etapa,
          etapaNome: NOME_ETAPA[e.etapa],
          media: e.media,
          treinamentoSugerido: TREINAMENTO_SUGERIDO[e.etapa],
        });
      }
    }
  }

  return sugestoes.sort((a, b) => a.media - b.media);
}

/** Tendência geral da operação, considerando todas as avaliações registradas. */
export async function calcularTendenciaGeral(): Promise<Tendencia> {
  const avaliacoes = await getAvaliacoes();
  return calcularTendencia(avaliacoes.map((a) => a.imtScore));
}

export function rotuloTendencia(t: Tendencia): string {
  switch (t) {
    case "subindo":
      return "Subindo";
    case "caindo":
      return "Caindo";
    case "estavel":
      return "Estável";
    default:
      return "Sem dados suficientes";
  }
}
