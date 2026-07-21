import PageHeader from "@/components/PageHeader";
import ImportadorColaboradores from "./ImportadorColaboradores";
import { requireAdmin } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

// Página admin-only: Smart Sync reestrutura o Cadastro Mestre de
// Colaboradores em massa (operação sensível, não listada no acesso do
// TECNICO na especificação da Etapa 3 — ver lib/autorizacao.ts).
export default async function ImportacaoPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="Importação Massiva de Colaboradores"
        description="Envie o arquivo Excel oficial e o sistema sincroniza automaticamente o Cadastro Mestre (Smart Sync): insere novos, atualiza existentes e inativa quem não aparece mais na planilha."
      />
      <ImportadorColaboradores />
    </div>
  );
}
