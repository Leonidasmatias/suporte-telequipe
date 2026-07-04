import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { createEquipe, deleteEquipe } from "./actions";

export const dynamic = "force-dynamic";

type Equipe = {
  id: number;
  nome: string;
  regional: string | null;
  lider_nome: string | null;
  membros: number;
};

type Lider = { id: number; nome: string };

export default function EquipesPage() {
  const equipes = db
    .prepare(
      `SELECT e.id, e.nome, e.regional, l.nome as lider_nome,
              (SELECT COUNT(*) FROM colaboradores c WHERE c.equipe_id = e.id AND c.status = 'ativo') as membros
       FROM equipes e
       LEFT JOIN lideres l ON l.id = e.lider_id
       ORDER BY e.nome ASC`
    )
    .all() as Equipe[];

  const lideres = db.prepare("SELECT id, nome FROM lideres ORDER BY nome ASC").all() as Lider[];

  return (
    <div>
      <PageHeader title="Equipes" description="Times de campo organizados por regional e liderança." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Nova equipe</h2>
          <form action={createEquipe} className="space-y-4">
            <div>
              <label className="label-field">Nome da equipe</label>
              <input name="nome" required className="input-field" placeholder="Ex: Equipe Alfa - Instalações" />
            </div>
            <div>
              <label className="label-field">Regional</label>
              <input name="regional" className="input-field" placeholder="Ex: Regional Sul" />
            </div>
            <div>
              <label className="label-field">Líder responsável</label>
              <select name="lider_id" className="input-field">
                <option value="">Sem líder definido</option>
                {lideres.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Cadastrar equipe</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Equipes cadastradas ({equipes.length})</h2>
          {equipes.length === 0 ? (
            <EmptyState message="Nenhuma equipe cadastrada ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Regional</th>
                    <th>Líder</th>
                    <th>Membros</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {equipes.map((eq) => (
                    <tr key={eq.id}>
                      <td className="font-medium text-slate-900">{eq.nome}</td>
                      <td>{eq.regional || "—"}</td>
                      <td>{eq.lider_nome || "—"}</td>
                      <td>
                        <span className="badge bg-brand-50 text-brand-700">{eq.membros}</span>
                      </td>
                      <td>
                        <form action={deleteEquipe}>
                          <input type="hidden" name="id" value={eq.id} />
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
