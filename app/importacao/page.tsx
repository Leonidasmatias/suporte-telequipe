import PageHeader from "@/components/PageHeader";
import SomenteLeituraNotice from "@/components/SomenteLeituraNotice";
import ImportadorColaboradores from "./ImportadorColaboradores";
import { estaEmModoEdicao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ImportacaoPage() {
  const podeEditar = estaEmModoEdicao();

  return (
    <div>
      <PageHeader
        title="Importação Massiva de Colaboradores"
        description="Envie o arquivo Excel oficial e o sistema sincroniza automaticamente o Cadastro Mestre (Smart Sync): insere novos, atualiza existentes e inativa quem não aparece mais na planilha."
      />
      {podeEditar ? (
        <ImportadorColaboradores />
      ) : (
        <SomenteLeituraNotice mensagem="Modo de visualização — destrave a edição na barra lateral para importar planilhas." />
      )}
    </div>
  );
}
