import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import TrendBadge from "@/components/TrendBadge";
import ScoreBar from "@/components/ScoreBar";
import { criarTreinamentoSugerido } from "./actions";
import {
  buildColaboradorInsights,
  buildAlertas,
  buildSugestoesTreinamento,
  calcularTendenciaGeral,
  NOME_ETAPA,
  LIMIAR_ALERTA,
} from "@/lib/imt";
import { estaEmModoEdicao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InsightsOperacionaisPage() {
  const podeEditar = estaEmModoEdicao();
  const colaboradores = await buildColaboradorInsights();
  const alertas = buildAlertas(colaboradores);
  const sugestoes = buildSugestoesTreinamento(colaboradores);
  const tendenciaGeral = await calcularTendenciaGeral();

  const emEvolucao = colaboradores.filter((c) => c.tendencia === "subindo");
  const emQueda = colaboradores.filter((c) => c.tendencia === "caindo");

  const gargaloOrdenado = [...colaboradores]
    .filter((c) => c.gargalo !== null)
    .sort((a, b) => (a.gargalo!.media - b.gargalo!.media));

  return (
    <div>
      <PageHeader
        title="Insights Operacionais"
        description="Gargalo operacional, ranking e tendência de IMT — inteligência da operação Nokia em tempo real."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Colaboradores avaliados" value={colaboradores.length} accent="brand" />
        <StatCard label="Em evolução" value={emEvolucao.length} accent="green" />
        <StatCard label="Etapas em alerta" value={alertas.length} accent="amber" />
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Tendência geral</p>
          <div className="mt-3">
            <TrendBadge tendencia={tendenciaGeral} />
          </div>
        </div>
      </div>

      {/* Gargalo operacional */}
      <div className="card mt-8">
        <h2 className="mb-1 text-base font-semibold text-white">Motor de gargalo operacional</h2>
        <p className="mb-4 text-xs text-graphite-500">
          Etapa com a menor média de IMT entre MOS, XML, TX, SWAP, FAM e REVERSA, por colaborador — ordenado do gargalo mais crítico para o menos crítico.
        </p>
        {gargaloOrdenado.length === 0 ? (
          <EmptyState message="Nenhum gargalo identificado ainda. Cadastre avaliações na Matriz Nokia." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>IMT médio</th>
                  <th>Etapa crítica</th>
                  <th>Tendência</th>
                </tr>
              </thead>
              <tbody>
                {gargaloOrdenado.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-white">{c.nome}</td>
                    <td><ScoreBar value={c.mediaGeral} /></td>
                    <td>
                      <span className="badge chip-danger">
                        {NOME_ETAPA[c.gargalo!.etapa]} · {Math.round(c.gargalo!.media)}%
                      </span>
                    </td>
                    <td><TrendBadge tendencia={c.tendencia} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ranking inteligente */}
      <div className="mt-8 card">
        <h2 className="mb-1 text-base font-semibold text-white">Ranking de colaboradores</h2>
        <p className="mb-4 text-xs text-graphite-500">IMT (70%) + consistência (30%)</p>
        {colaboradores.length === 0 ? (
          <EmptyState message="Sem dados suficientes." />
        ) : (
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {colaboradores.slice(0, 12).map((c, i) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-900/40 px-3 py-2">
                <span className="text-sm text-graphite-200">
                  <span className="mr-2 text-xs font-semibold tabular-nums text-graphite-600">#{i + 1}</span>
                  {c.nome}
                </span>
                <span className="badge chip-success tabular-nums">{c.rankingScore}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Análise temporal */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Em evolução</h2>
          {emEvolucao.length === 0 ? (
            <EmptyState message="Nenhum colaborador com tendência de alta no momento." />
          ) : (
            <div className="space-y-2">
              {emEvolucao.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-900/40 px-3 py-2">
                  <span className="text-sm text-graphite-200">{c.nome}</span>
                  <TrendBadge tendencia={c.tendencia} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Atenção: em queda</h2>
          {emQueda.length === 0 ? (
            <EmptyState message="Nenhum colaborador com tendência de queda no momento." />
          ) : (
            <div className="space-y-2">
              {emQueda.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2">
                  <span className="text-sm text-graphite-200">{c.nome}</span>
                  <TrendBadge tendencia={c.tendencia} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sugestões automáticas de treinamento */}
      <div className="card mt-8">
        <h2 className="mb-1 text-base font-semibold text-white">Sugestões automáticas de treinamento</h2>
        <p className="mb-4 text-xs text-graphite-500">
          Gerado automaticamente sempre que o IMT de uma etapa fica abaixo de {LIMIAR_ALERTA}%.
        </p>
        {sugestoes.length === 0 ? (
          <EmptyState message="Nenhuma sugestão no momento — todas as etapas estão acima do limiar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Etapa com falha</th>
                  <th>IMT</th>
                  <th>Treinamento sugerido</th>
                  {podeEditar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sugestoes.map((s, i) => (
                  <tr key={`${s.colaborador_id}-${s.etapa}-${i}`}>
                    <td className="font-medium text-white">{s.colaborador_nome}</td>
                    <td>{s.etapaNome}</td>
                    <td className="tabular-nums">{Math.round(s.media)}%</td>
                    <td>{s.treinamentoSugerido}</td>
                    {podeEditar && (
                      <td>
                        <form action={criarTreinamentoSugerido}>
                          <input type="hidden" name="colaborador_id" value={s.colaborador_id} />
                          <input type="hidden" name="etapa" value={s.etapa} />
                          <button type="submit" className="btn-secondary">Criar treinamento</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
