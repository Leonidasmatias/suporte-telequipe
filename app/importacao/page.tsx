import PageHeader from "@/components/PageHeader";
import ImportadorColaboradores from "./ImportadorColaboradores";

export const dynamic = "force-dynamic";

export default function ImportacaoPage() {
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
