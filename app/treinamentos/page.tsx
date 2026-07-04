import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { createTreinamento, deleteTreinamento } from "./actions";

export const dynamic = "force-dynamic";

type Treinamento = {
  id: number;
  nome: string;
  categoria: string | null;
  carga_horaria: number | null;
  data_realizacao: string | null;
  instrutor: string | null;
  participantes: number;
};

export default function TreinamentosPage() {
  const treinamentos = db
    .prepare(
      `SELECT t.id, t.nome, t.categoria, t.carga_horaria, t.data_realizacao, t.instrutor,
              (SELECT COUNT(*) FROM treinamento_colaboradores tc WHERE tc.treinamento_id = t.id) as participantes
       FROM treinamentos t
       ORDER BY t.data_realizacao DESC`
    )
    .all() as Treinamento[];

  return (
    <div>
      <PageHeader title="Treinamentos" description="Capacitações técnicas e certificações realizadas pela equipe." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Novo treinamento</h2>
          <form action={createTreinamento} className="space-y-4">
            <div>
              <label className="label-field">Nome</label>
              <input name="nome" required className="input-field" placeholder="Ex: Certificação Nokia AirScale" />
            </div>
            <div>
              <label className="label-field">Categoria</label>
              <input name="categoria" className="input-field" placeholder="Ex: Certificação Nokia" />
            </div>
            <div>
              <label className="label-field">Carga horária (h)</label>
              <input name="carga_horaria" type="number" min={0} className="input-field" placeholder="0" />
            </div>
            <div>
              <label className="label-field">Data de realização</label>
              <input name="data_realizacao" type="date" className="input-field" />
            </div>
            <div>
              <label className="label-field">Instrutor</label>
              <input name="instrutor" className="input-field" placeholder="Nome do instrutor" />
            </div>
            <button type="submit" className="btn-primary w-full">Cadastrar treinamento</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Treinamentos cadastrados ({treinamentos.length})
          </h2>
          {treinamentos.length === 0 ? (
            <EmptyState message="Nenhum treinamento cadastrado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Carga</th>
                    <th>Data</th>
                    <th>Participantes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {treinamentos.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium text-slate-900">{t.nome}</td>
                      <td>{t.categoria || "—"}</td>
                      <td>{t.carga_horaria ? `${t.carga_horaria}h` : "—"}</td>
                      <td>{t.data_realizacao || "—"}</td>
                      <td>
                        <span className="badge bg-brand-50 text-brand-700">{t.participantes}</span>
                      </td>
                      <td>
                        <form action={deleteTreinamento}>
                          <input type="hidden" name="id" value={t.id} />
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
    </div>
  );
}
