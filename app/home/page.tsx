import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import TrendBadge from "@/components/TrendBadge";
import ScoreBar from "@/components/ScoreBar";
import {
  buildColaboradorInsights,
  buildAlertas,
  calcularTendenciaGeral,
  NOME_ETAPA,
} from "@/lib/imt";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    totalColaboradores,
    totalAtivos,
    totalCLT,
    totalPJ,
    totalTreinamentos,
    imtAgg,
    ultimaImportacaoAgg,
    ultimaAtualizacaoAgg,
  ] = await Promise.all([
    prisma.colaborador.count(),
    prisma.colaborador.count({ where: { status: "ativo" } }),
    prisma.colaborador.count({ where: { tipoPessoa: "CLT" } }),
    prisma.colaborador.count({ where: { tipoPessoa: "PJ" } }),
    prisma.treinamento.count(),
    prisma.avaliacaoCompetencia.aggregate({ _avg: { nota: true } }),
    prisma.colaborador.aggregate({ _max: { dataImportacao: true } }),
    prisma.colaborador.aggregate({ _max: { ultimaAtualizacao: true } }),
  ]);
  const totalInativos = totalColaboradores - totalAtivos;
  const imtMedio = imtAgg._avg.nota;

  const tendenciaGeral = await calcularTendenciaGeral();
  const colaboradorInsights = await buildColaboradorInsights();
  const alertas = buildAlertas(colaboradorInsights);

  const colaboradoresRecentesRaw = await prisma.colaborador.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const colaboradoresRecentes = colaboradoresRecentesRaw.map((c) => ({
    id: c.id,
    nome: c.nome,
    cargo: c.cargo,
    regional: c.regional,
    status: c.status,
  }));

  const treinamentosRecentesRaw = await prisma.treinamento.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const treinamentosRecentes = treinamentosRecentesRaw.map((t) => ({
    id: t.id,
    nome: t.titulo,
    categoria: t.categoria,
    data: t.data ? t.data.toISOString().slice(0, 10) : null,
  }));

  return (
    <div>
      <PageHeader
        title="Centro de Operações"
        description="Visão geral em tempo real da operação de campo — SUPORTE TELEQUIPE"
        action={
          <Link href="/insights-operacionais" className="btn-secondary">
            Ver Insights Operacionais
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Colaboradores" value={totalColaboradores} accent="brand" />
        <StatCard label="Ativos" value={totalAtivos} accent="green" />
        <StatCard label="Inativos" value={totalInativos} accent="slate" />
        <StatCard label="CLT" value={totalCLT} accent="brand" />
        <StatCard label="PJ" value={totalPJ} accent="amber" />
        <StatCard label="Treinamentos" value={totalTreinamentos} accent="slate" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">IMT médio geral</p>
          <p className="mt-2 inline-flex rounded-lg bg-neon-500/10 px-2 py-1 text-3xl font-semibold tabular-nums text-neon-400">
            {imtMedio !== null ? `${Math.round(imtMedio)}%` : "—"}
          </p>
          <div className="mt-2">
            <TrendBadge tendencia={tendenciaGeral} />
          </div>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Cadastro Mestre</p>
          <p className="mt-2 text-sm text-graphite-300">
            Última importação:{" "}
            <span className="font-medium text-graphite-100">
              {ultimaImportacaoAgg._max.dataImportacao
                ? ultimaImportacaoAgg._max.dataImportacao.toISOString().slice(0, 16).replace("T", " ")
                : "—"}
            </span>
          </p>
          <p className="mt-1 text-sm text-graphite-300">
            Última sincronização:{" "}
            <span className="font-medium text-graphite-100">
              {ultimaAtualizacaoAgg._max.ultimaAtualizacao
                ? ultimaAtualizacaoAgg._max.ultimaAtualizacao.toISOString().slice(0, 16).replace("T", " ")
                : "—"}
            </span>
          </p>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mt-6 card border-amber-500/20 bg-amber-500/[0.04]">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <h2 className="text-base font-semibold text-white">Alertas automáticos por etapa Nokia</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alertas.map((alerta) => (
              <div key={alerta.etapa} className="rounded-lg border border-amber-500/20 bg-graphite-900/60 px-4 py-3">
                <p className="text-sm font-medium text-graphite-100">{alerta.etapaNome}</p>
                <p className="mt-1 text-xs text-amber-400">
                  {alerta.quantidade} colaborador(es) abaixo de 70% de IMT
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 card">
        <h2 className="mb-4 text-base font-semibold text-white">IMT por colaborador</h2>
        {colaboradorInsights.length === 0 ? (
          <EmptyState message="Cadastre avaliações na Matriz Nokia para começar." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colaboradorInsights.slice(0, 6).map((c) => (
              <div key={c.id} className="rounded-lg border border-graphite-700 bg-graphite-900/40 px-3 py-2.5 transition-colors duration-150 hover:border-graphite-600">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-graphite-100">{c.nome}</p>
                  <TrendBadge tendencia={c.tendencia} />
                </div>
                <div className="mt-2">
                  <ScoreBar value={c.mediaGeral} />
                </div>
                {c.gargalo && (
                  <p className="mt-1 text-xs text-graphite-500">
                    Gargalo: {NOME_ETAPA[c.gargalo.etapa]} ({Math.round(c.gargalo.media)}%)
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Colaboradores recentes</h2>
          {colaboradoresRecentes.length === 0 ? (
            <EmptyState message="Nenhum colaborador cadastrado ainda." />
          ) : (
            <div className="space-y-3">
              {colaboradoresRecentes.map((c) => (
                <Link
                  key={c.id}
                  href={`/colaboradores/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 transition-colors duration-150 hover:border-neon-500/40 hover:bg-neon-500/[0.03]"
                >
                  <div>
                    <p className="text-sm font-medium text-graphite-100">{c.nome}</p>
                    <p className="text-xs text-graphite-500">
                      {c.cargo ?? "Cargo não definido"} · {c.regional ?? "Regional não definida"}
                    </p>
                  </div>
                  <span className={`badge ${c.status === "ativo" ? "chip-success" : "chip-neutral"}`}>{c.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Treinamentos recentes</h2>
          {treinamentosRecentes.length === 0 ? (
            <EmptyState message="Nenhum treinamento cadastrado ainda." />
          ) : (
            <div className="space-y-3">
              {treinamentosRecentes.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 transition-colors duration-150 hover:border-graphite-600">
                  <div>
                    <p className="text-sm font-medium text-graphite-100">{t.nome}</p>
                    <p className="text-xs text-graphite-500">{t.categoria ?? "Sem categoria"}</p>
                  </div>
                  <span className="text-xs text-graphite-500">{t.data ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
