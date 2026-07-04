import Link from "next/link";
import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import TrendBadge from "@/components/TrendBadge";
import ScoreBar from "@/components/ScoreBar";
import {
  buildColaboradorInsights,
  buildEquipeInsights,
  buildLiderInsights,
  buildAlertas,
  calcularTendenciaGeral,
  NOME_ETAPA,
} from "@/lib/imt";

export const dynamic = "force-dynamic";

type CountRow = { c: number };
type AvgRow = { a: number | null };

export default function HomePage() {
  const totalLideres = (db.prepare("SELECT COUNT(*) as c FROM lideres").get() as CountRow).c;
  const totalEquipes = (db.prepare("SELECT COUNT(*) as c FROM equipes").get() as CountRow).c;
  const totalColaboradores = (
    db.prepare("SELECT COUNT(*) as c FROM colaboradores WHERE status = 'ativo'").get() as CountRow
  ).c;
  const totalTreinamentos = (db.prepare("SELECT COUNT(*) as c FROM treinamentos").get() as CountRow).c;
  const imtMedio = (db.prepare("SELECT AVG(imt_score) as a FROM matriz_nokia").get() as AvgRow).a;

  const tendenciaGeral = calcularTendenciaGeral();
  const colaboradorInsights = buildColaboradorInsights();
  const equipeInsights = buildEquipeInsights();
  const liderInsights = buildLiderInsights();
  const alertas = buildAlertas(colaboradorInsights);

  const equipesResumo = db
    .prepare(
      `SELECT e.id, e.nome, e.regional, l.nome as lider_nome,
              (SELECT COUNT(*) FROM colaboradores c WHERE c.equipe_id = e.id AND c.status = 'ativo') as membros
       FROM equipes e
       LEFT JOIN lideres l ON l.id = e.lider_id
       ORDER BY e.created_at DESC
       LIMIT 5`
    )
    .all() as { id: number; nome: string; regional: string | null; lider_nome: string | null; membros: number }[];

  const treinamentosRecentes = db
    .prepare(
      `SELECT id, nome, categoria, data_realizacao FROM treinamentos ORDER BY created_at DESC LIMIT 5`
    )
    .all() as { id: number; nome: string; categoria: string | null; data_realizacao: string | null }[];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação de campo — SUPORTE TELEQUIPE"
        action={
          <Link href="/insights-operacionais" className="btn-secondary">
            Ver Insights Operacionais
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Líderes" value={totalLideres} accent="brand" />
        <StatCard label="Equipes" value={totalEquipes} accent="slate" />
        <StatCard label="Colaboradores ativos" value={totalColaboradores} accent="green" />
        <StatCard label="Treinamentos" value={totalTreinamentos} accent="amber" />
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">IMT médio geral</p>
          <p className="mt-2 inline-flex rounded-lg bg-brand-50 px-2 py-1 text-3xl font-semibold text-brand-600">
            {imtMedio !== null ? `${Math.round(imtMedio)}%` : "—"}
          </p>
          <div className="mt-2">
            <TrendBadge tendencia={tendenciaGeral} />
          </div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mt-6 card border-amber-200 bg-amber-50/40">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Alertas automáticos por etapa Nokia</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alertas.map((alerta) => (
              <div key={alerta.etapa} className="rounded-lg border border-amber-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-slate-800">{alerta.etapaNome}</p>
                <p className="mt-1 text-xs text-amber-700">
                  {alerta.quantidade} colaborador(es) abaixo de 70% de IMT
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">IMT por líder</h2>
          {liderInsights.length === 0 ? (
            <EmptyState message="Sem avaliações vinculadas a líderes ainda." />
          ) : (
            <div className="space-y-3">
              {liderInsights.slice(0, 5).map((l) => (
                <div key={l.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{l.nome}</p>
                    <TrendBadge tendencia={l.tendencia} />
                  </div>
                  <div className="mt-2">
                    <ScoreBar value={l.mediaGeral} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">IMT por equipe</h2>
          {equipeInsights.length === 0 ? (
            <EmptyState message="Sem avaliações vinculadas a equipes ainda." />
          ) : (
            <div className="space-y-3">
              {equipeInsights.slice(0, 5).map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{e.nome}</p>
                    <TrendBadge tendencia={e.tendencia} />
                  </div>
                  <div className="mt-2">
                    <ScoreBar value={e.mediaGeral} />
                  </div>
                  {e.gargalo && (
                    <p className="mt-1 text-xs text-slate-500">
                      Gargalo: {NOME_ETAPA[e.gargalo.etapa]} ({Math.round(e.gargalo.media)}%)
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">IMT por colaborador</h2>
          {colaboradorInsights.length === 0 ? (
            <EmptyState message="Cadastre avaliações na Matriz Nokia para começar." />
          ) : (
            <div className="space-y-3">
              {colaboradorInsights.slice(0, 5).map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                    <TrendBadge tendencia={c.tendencia} />
                  </div>
                  <div className="mt-2">
                    <ScoreBar value={c.mediaGeral} />
                  </div>
                  {c.gargalo && (
                    <p className="mt-1 text-xs text-slate-500">
                      Gargalo: {NOME_ETAPA[c.gargalo.etapa]} ({Math.round(c.gargalo.media)}%)
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Equipes recentes</h2>
          {equipesResumo.length === 0 ? (
            <EmptyState message="Nenhuma equipe cadastrada ainda." />
          ) : (
            <div className="space-y-3">
              {equipesResumo.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{eq.nome}</p>
                    <p className="text-xs text-slate-500">
                      {eq.regional ?? "Regional não definida"} · Líder: {eq.lider_nome ?? "não definido"}
                    </p>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">{eq.membros} membros</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Treinamentos recentes</h2>
          {treinamentosRecentes.length === 0 ? (
            <EmptyState message="Nenhum treinamento cadastrado ainda." />
          ) : (
            <div className="space-y-3">
              {treinamentosRecentes.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.nome}</p>
                    <p className="text-xs text-slate-500">{t.categoria ?? "Sem categoria"}</p>
                  </div>
                  <span className="text-xs text-slate-400">{t.data_realizacao ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
