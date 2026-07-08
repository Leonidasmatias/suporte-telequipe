import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import TempoAtendimentoInputs from "@/components/TempoAtendimentoInputs";
import SomenteLeituraNotice from "@/components/SomenteLeituraNotice";
import { createTicket } from "../actions";
import { TIPOS_ATENDIMENTO, CATEGORIAS_SUPORTE, RESULTADOS_SUPORTE, STATUS_SUPORTE } from "@/lib/suporte";
import { estaEmModoEdicao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NovoAtendimentoPage() {
  const podeEditar = estaEmModoEdicao();
  if (!podeEditar) {
    return (
      <div>
        <PageHeader title="Novo atendimento" description="Registrar um atendimento técnico prestado a um colaborador de campo." />
        <SomenteLeituraNotice mensagem="Modo de visualização — destrave a edição na barra lateral para registrar um atendimento." />
      </div>
    );
  }

  const colaboradores = await prisma.colaborador.findMany({
    where: { status: "ativo" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cargo: true },
  });

  return (
    <div>
      <PageHeader
        title="Novo atendimento"
        description="Registrar um atendimento técnico prestado a um colaborador de campo."
      />

      <form action={createTicket} className="card space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field">Data</label>
            <input name="data_atendimento" type="date" required className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <TempoAtendimentoInputs />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label-field">Colaborador</label>
            <select name="colaborador_id" className="input-field">
              <option value="">Não informado</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.cargo ? ` — ${c.cargo}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Projeto</label>
            <input name="projeto" className="input-field" placeholder="Ex: Expansão 5G Regional Sul" />
          </div>
          <div>
            <label className="label-field">Cliente</label>
            <input name="cliente" className="input-field" placeholder="Ex: Nokia / Operadora X" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-field">Tipo de atendimento</label>
            <select name="tipo_atendimento" required className="input-field" defaultValue="">
              <option value="" disabled>Selecione</option>
              {TIPOS_ATENDIMENTO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select name="categoria" required className="input-field" defaultValue="">
              <option value="" disabled>Selecione</option>
              {CATEGORIAS_SUPORTE.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Resultado</label>
            <select name="resultado" required className="input-field" defaultValue="">
              <option value="" disabled>Selecione</option>
              {RESULTADOS_SUPORTE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select name="status" className="input-field" defaultValue="Aberto">
              {STATUS_SUPORTE.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-field">Descrição do problema</label>
          <textarea
            name="descricao_problema"
            required
            rows={3}
            className="input-field"
            placeholder="Descreva o problema relatado pela equipe de campo"
          />
        </div>

        <div>
          <label className="label-field">Solução aplicada</label>
          <textarea
            name="solucao_aplicada"
            rows={3}
            className="input-field"
            placeholder="Descreva a solução aplicada durante o atendimento"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Técnico responsável</label>
            <input name="tecnico_responsavel" className="input-field" placeholder="Nome do técnico de suporte" />
          </div>
          <div>
            <label className="label-field">Observações</label>
            <input name="observacoes" className="input-field" placeholder="Observações adicionais" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-graphite-800 pt-4">
          <button type="submit" className="btn-primary">Salvar atendimento</button>
        </div>
      </form>
    </div>
  );
}
