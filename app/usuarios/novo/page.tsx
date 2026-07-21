import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/autorizacao";
import UsuarioForm from "../UsuarioForm";
import { createUsuario } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="Novo usuário"
        description="Criar uma nova conta de acesso ao sistema."
      />

      <div className="max-w-xl">
        <UsuarioForm action={createUsuario} modo="criar" />
      </div>
    </div>
  );
}
