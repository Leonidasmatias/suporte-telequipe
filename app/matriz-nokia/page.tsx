import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import ScoreBar from "@/components/ScoreBar";
import { createAvaliacao, deleteAvaliacao } from "./actions";
import { ETAPAS, NOME_ETAPA, buildColaboradorInsights, type EtapaCodigo } from "@/lib/imt";

export const dynamic = "force-dynamic";

type Avaliacao = {
  id: number;
  colaborador_nome: string;
  etapa: EtapaCodigo;
  nivel: string;
  imt_score: number;
  data_avaliacao: string | null;
};

type Colaborador = { id: number; nome: string };
type AvgRow = { a: number | null };

const niveis = ["Não certificado", "Básico", "Intermediário", "Avançado"];

function nivelBadgeClass(nivel: string) {
  switch (nivel) {
    case "Avançado":
      return "bg-emerald-50 text-emerald-700";
    case "Intermediário":
      return "bg-brand-50 text-brand-700";
    case "Básico":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

export default function MatrizNokiaPage() {
  const avaliacoes = db
    .prepare(
      `SELECT m.id, c.nome as colaborador_nome, m.etapa, m.nivel, m.imt_score, m.data_avaliacao
       FROM matriz_nokia m
       JOIN colaboradores c ON c.id = m.colaborador_id
       ORDER BY m.created_at DESC`
    )
    .all() as Avaliacao[];

  const colaboradores = db
    .prepare("SELECT id, nome FROM colaboradores ORDER BY nome ASC")
    .all() as Colaborador[];

  const imtMedio = (db.prepare("SELECT AVG(imt_score) as a FROM matriz_nokia").get() as AvgRow).a;

  const insights = buildColaboradorInsights();

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
          <h2 className="mb-4 text-base font-semibold text-slate-900">Nova avaliação</h2>
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
          <h2 className="mb-4 text-base font-semibold text-slate-900">Avaliações registradas</h2>
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
                      <td className="font-medium text-slate-900">{a.colaborador_nome}</td>
                      <td>{NOME_ETAPA[a.etapa]}</td>
                      <td>
                        <span className={`badge ${nivelBadgeClass(a.nivel)}`}>{a.nivel}</span>
                      </td>
                      <td>{a.imt_score}%</td>
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
        <h2 className="mb-1 text-base font-semibold text-slate-900">Gargalo por colaborador</h2>
        <p className="mb-4 text-xs text-slate-500">
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
                  <th>Equipe</th>
                  <th>IMT médio</th>
                  <th>Etapa crítica (gargalo)</th>
                </tr>
              </thead>
              <tbody>
                {insights.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-slate-900">{c.nome}</td>
                    <td>{c.equipe_nome ?? "—"}</td>
                    <td><ScoreBar value={c.mediaGeral} /></td>
                    <td>
                      {c.gargalo ? (
                        <span className="badge bg-red-50 text-red-600">
                          {NOME_ETAPA[c.gargalo.etapa]} · {Math.round(c.gargalo.media)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
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
