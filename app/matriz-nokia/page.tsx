import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import ScoreBar from "@/components/ScoreBar";
import { createAvaliacao, deleteAvaliacao } from "./actions";
import { ETAPAS, NOME_ETAPA, buildColaboradorInsights, type EtapaCodigo } from "@/lib/imt";

export const dynamic = "force-dynamic";

const niveis = ["Não certificado", "Básico", "Intermediário", "Avançado"];

function nivelBadgeClass(nivel: string) {
  switch (nivel) {
    case "Avançado":
      return "chip-success";
    case "Intermediário":
      return "chip-info";
    case "Básico":
      return "chip-warning";
    default:
      return "chip-neutral";
  }
}

export default async function MatrizNokiaPage() {
  const avaliacoesRaw = await prisma.avaliacaoCompetencia.findMany({
    include: { colaborador: true, competencia: true },
    orderBy: { createdAt: "desc" },
  });

  const avaliacoes = avaliacoesRaw.map((a) => ({
    id: a.id,
    colaboradorNome: a.colaborador.nome,
    etapa: a.competencia.nome as EtapaCodigo,
    nivel: a.nivel,
    imtScore: a.nota,
  }));

  const colaboradores = await prisma.colaborador.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  const imtAgg = await prisma.avaliacaoCompetencia.aggregate({ _avg: { nota: true } });
  const imtMedio = imtAgg._avg.nota;

  const insights = await buildColaboradorInsights();

  return (
    <div>
      <PageHeader
        title="Matriz Nokia"
        description="Avaliação por etapa Nokia (MOS, XML, TX, SWAP, FAM, REVERSA) — base do Índice de Maturidade Técnica (IMT)."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Avaliações registradas" value={avaliacoes.length} accent="slate" />
        <StatCard
          label="IMT médio geral"
          value={imtMedio !== null ? `${Math.round(imtMedio)}%` : "—"}
          accent="brand"
        />
        <StatCard label="Colaboradores avaliados" value={insights.length} accent="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-white">Nova avaliação</h2>
          <form action={createAvaliacao} className="space-y-4">
            <div>
              <label className="label-field">Colaborador</label>
              <select name="colaborador_id" required className="input-field">
                <option value="">Selecione</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Etapa Nokia</label>
              <select name="etapa" required className="input-field" defaultValue="">
                <option value="" disabled>Selecione a etapa</option>
                {ETAPAS.map((e) => (
                  <option key={e.codigo} value={e.codigo}>{e.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Nível</label>
              <select name="nivel" className="input-field" defaultValue="Básico">
                {niveis.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">IMT Score (0-100)</label>
              <input name="imt_score" type="number" min={0} max={100} className="input-field" placeholder="0" />
            </div>
            <div>
              <label className="label-field">Data da avaliação</label>
              <input name="data_avaliacao" type="date" className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full">Registrar avaliação</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">Avaliações registradas</h2>
          {avaliacoes.length === 0 ? (
            <EmptyState message="Nenhuma avaliação registrada ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Etapa</th>
                    <th>Nível</th>
                    <th>IMT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {avaliacoes.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-white">{a.colaboradorNome}</td>
                      <td>{NOME_ETAPA[a.etapa]}</td>
                      <td>
                        <span className={`badge ${nivelBadgeClass(a.nivel)}`}>{a.nivel}</span>
                      </td>
                      <td className="tabular-nums">{a.imtScore}%</td>
                      <td>
                        <form action={deleteAvaliacao}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className="btn-danger">Remover</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="mb-1 text-base font-semibold text-white">Gargalo por colaborador</h2>
        <p className="mb-4 text-xs text-graphite-500">
          Etapa com a menor média de IMT entre MOS, XML, TX, SWAP, FAM e REVERSA para cada colaborador avaliado.
        </p>
        {insights.length === 0 ? (
          <EmptyState message="Cadastre avaliações para identificar o gargalo de cada colaborador." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>IMT médio</th>
                  <th>Etapa crítica (gargalo)</th>
                </tr>
              </thead>
              <tbody>
                {insights.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-white">{c.nome}</td>
                    <td><ScoreBar value={c.mediaGeral} /></td>
                    <td>
                      {c.gargalo ? (
                        <span className="badge chip-danger">
                          {NOME_ETAPA[c.gargalo.etapa]} · {Math.round(c.gargalo.media)}%
                        </span>
                      ) : (
                        <span className="text-xs text-graphite-600">—</span>
                      )}
                    </td>
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
