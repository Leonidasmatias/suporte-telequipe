import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { ToggleAtivoButton } from "./AcoesRisco";
import { requireAdmin } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
};

// Etapa 2 — Gestão de Usuários. Página inteira é admin-only: requireAdmin()
// redireciona para /login (não autenticado) ou /acesso-negado (autenticado
// mas não ADMIN) antes de qualquer consulta ao banco.
export default async function UsuariosPage() {
  const usuarioLogado = await requireAdmin();

  const [total, totalAtivos, usuarios] = await Promise.all([
    prisma.usuario.count(),
    prisma.usuario.count({ where: { ativo: true } }),
    prisma.usuario.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gestão de contas de acesso ao sistema — perfis ADMIN e TECNICO."
        action={
          <Link href="/usuarios/novo" className="btn-primary">
            Novo usuário
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de usuários" value={total} accent="brand" />
        <StatCard label="Ativos" value={totalAtivos} accent="green" />
        <StatCard label="Inativos" value={total - totalAtivos} accent="slate" />
      </div>

      <div className="mt-6 card">
        <h2 className="mb-4 text-base font-semibold text-white">
          Usuários cadastrados ({usuarios.length})
        </h2>
        {usuarios.length === 0 ? (
          <EmptyState message="Nenhum usuário cadastrado ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const ehVoceMesmo = u.id === usuarioLogado.id;
                  return (
                    <tr key={u.id}>
                      <td className="font-medium text-white">
                        {u.nome}
                        {ehVoceMesmo && <span className="ml-2 badge chip-info">Você</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.perfil === "ADMIN" ? "chip-info" : "chip-success"}`}>
                          {ROTULO_PERFIL[u.perfil] ?? u.perfil}
                        </span>
                      </td>
                      <td>
                        {ehVoceMesmo ? (
                          <span
                            className={`badge ${u.ativo ? "chip-success" : "chip-neutral"}`}
                            title="Não é possível desativar a própria conta"
                          >
                            {u.ativo ? "Ativo" : "Inativo"}
                          </span>
                        ) : (
                          <ToggleAtivoButton id={u.id} ativo={u.ativo} />
                        )}
                      </td>
                      <td>
                        <Link href={`/usuarios/${u.id}`} className="btn-secondary">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
