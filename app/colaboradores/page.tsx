import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { createColaborador, deleteColaborador } from "./actions";

export const dynamic = "force-dynamic";

type Colaborador = {
  id: number;
  nome: string;
  funcao: string | null;
  equipe_nome: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  data_admissao: string | null;
};

type Equipe = { id: number; nome: string };

export default function ColaboradoresPage() {
  const colaboradores = db
    .prepare(
      `SELECT c.id, c.nome, c.funcao, e.nome as equipe_nome, c.telefone, c.email, c.status, c.data_admissao
       FROM colaboradores c
       LEFT JOIN equipes e ON e.id = c.equipe_id
       ORDER BY c.nome ASC`
    )
    .all() as Colaborador[];

  const equipes = db.prepare("SELECT id, nome FROM equipes ORDER BY nome ASC").all() as Equipe[];

  return (
    <div>
      <PageHeader title="Colaboradores" description="Técnicos de campo vinculados às equipes operacionais." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Novo colaborador</h2>
          <form action={createColaborador} className="space-y-4">
            <div>
              <label className="label-field">Nome</label>
              <input name="nome" required className="input-field" placeholder="Nome completo" />
            </div>
            <div>
              <label className="label-field">Função</label>
              <input name="funcao" className="input-field" placeholder="Ex: Técnico de Campo" />
            </div>
            <div>
              <label className="label-field">Equipe</label>
              <select name="equipe_id" className="input-field">
                <option value="">Sem equipe definida</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Telefone</label>
              <input name="telefone" className="input-field" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="label-field">E-mail</label>
              <input name="email" type="email" className="input-field" placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="label-field">Data de admissão</label>
              <input name="data_admissao" type="date" className="input-field" />
            </div>
            <div>
              <label className="label-field">Status</label>
              <select name="status" className="input-field" defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Cadastrar colaborador</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Colaboradores cadastrados ({colaboradores.length})
          </h2>
          {colaboradores.length === 0 ? (
            <EmptyState message="Nenhum colaborador cadastrado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Equipe</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-slate-900">{c.nome}</td>
                      <td>{c.funcao || "—"}</td>
                      <td>{c.equipe_nome || "—"}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === "ativo"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <form action={deleteColaborador}>
                          <input type="hidden" name="id" value={c.id} />
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
