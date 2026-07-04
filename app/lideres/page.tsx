import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { createLider, deleteLider } from "./actions";

export const dynamic = "force-dynamic";

type Lider = {
  id: number;
  nome: string;
  cargo: string | null;
  regional: string | null;
  telefone: string | null;
  email: string | null;
};

export default function LideresPage() {
  const lideres = db.prepare("SELECT * FROM lideres ORDER BY nome ASC").all() as Lider[];

  return (
    <div>
      <PageHeader title="Líderes" description="Coordenadores e supervisores responsáveis pelas equipes de campo." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Novo líder</h2>
          <form action={createLider} className="space-y-4">
            <div>
              <label className="label-field">Nome</label>
              <input name="nome" required className="input-field" placeholder="Nome completo" />
            </div>
            <div>
              <label className="label-field">Cargo</label>
              <input name="cargo" className="input-field" placeholder="Ex: Coordenador de Campo" />
            </div>
            <div>
              <label className="label-field">Regional</label>
              <input name="regional" className="input-field" placeholder="Ex: Regional Sul" />
            </div>
            <div>
              <label className="label-field">Telefone</label>
              <input name="telefone" className="input-field" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="label-field">E-mail</label>
              <input name="email" type="email" className="input-field" placeholder="email@empresa.com" />
            </div>
            <button type="submit" className="btn-primary w-full">Cadastrar líder</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Líderes cadastrados ({lideres.length})</h2>
          {lideres.length === 0 ? (
            <EmptyState message="Nenhum líder cadastrado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Regional</th>
                    <th>Contato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lideres.map((l) => (
                    <tr key={l.id}>
                      <td className="font-medium text-slate-900">{l.nome}</td>
                      <td>{l.cargo || "—"}</td>
                      <td>{l.regional || "—"}</td>
                      <td>
                        <div className="text-xs text-slate-500">{l.telefone || "—"}</div>
                        <div className="text-xs text-slate-500">{l.email || "—"}</div>
                      </td>
                      <td>
                        <form action={deleteLider}>
                          <input type="hidden" name="id" value={l.id} />
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
