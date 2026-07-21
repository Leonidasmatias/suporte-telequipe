import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/autorizacao";
import UsuarioForm from "../UsuarioForm";
import { updateUsuario } from "../actions";
import { ToggleAtivoAcaoGrande, ExcluirUsuarioButton } from "../AcoesRisco";

export const dynamic = "force-dynamic";

const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
};

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const usuarioLogado = await requireAdmin();
  const id = Number(params.id);
  if (!id) notFound();

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) notFound();

  const ehVoceMesmo = usuario.id === usuarioLogado.id;

  return (
    <div>
      <PageHeader
        title={usuario.nome}
        description={`${usuario.email} · ${ROTULO_PERFIL[usuario.perfil] ?? usuario.perfil}`}
        action={
          <span className={`badge ${usuario.ativo ? "chip-success" : "chip-neutral"}`}>
            {usuario.ativo ? "Ativo" : "Inativo"}
          </span>
        }
      />

      <div className="max-w-xl space-y-4">
        <UsuarioForm
          action={updateUsuario}
          modo="editar"
          valoresIniciais={{
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil as "ADMIN" | "TECNICO",
          }}
          bloquearTrocaPerfil={ehVoceMesmo}
        />

        {!ehVoceMesmo && (
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Zona de risco</p>
              <p className="mt-1 text-xs text-graphite-500">
                Desativar remove o acesso imediatamente. Excluir é permanente.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <ToggleAtivoAcaoGrande id={usuario.id} ativo={usuario.ativo} />
              <ExcluirUsuarioButton id={usuario.id} />
            </div>
          </div>
        )}
        {ehVoceMesmo && (
          <p className="rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 text-xs text-graphite-500">
            Você não pode desativar ou excluir a própria conta.
          </p>
        )}
      </div>
    </div>
  );
}
