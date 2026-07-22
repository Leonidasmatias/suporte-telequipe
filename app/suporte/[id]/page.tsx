import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import TempoAtendimentoInputs from "@/components/TempoAtendimentoInputs";
import SeletorCategoriaSuporte from "@/components/SeletorCategoriaSuporte";
import { updateTicket, closeTicket, deleteTicket } from "../actions";
import { TIPOS_ATENDIMENTO, RESULTADOS_SUPORTE, STATUS_SUPORTE } from "@/lib/suporte";
import { ACOES, RECURSOS, canPerform, requireAccess, criarFiltroDeAcessoAtendimentos } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

const badgeStatus: Record<string, string> = {
  Aberto: "chip-danger",
  "Em Atendimento": "chip-warning",
  Finalizado: "chip-success",
};

export default async function DetalheAtendimentoPage({ params }: { params: { id: string } }) {
  const usuario = await requireAccess(RECURSOS.atendimentos);
  const podeEditar = canPerform(usuario, ACOES["atendimentos.editar"]);
  const podeEncerrar = canPerform(usuario, ACOES["atendimentos.encerrar"]);
  const podeExcluir = canPerform(usuario, ACOES["atendimentos.excluir"]);
  const id = Number(params.id);
  if (!id) notFound();

  // A restrição de acesso já entra na PRÓPRIA consulta (findFirst com o
  // escopo do usuário no where) — nunca "busca por id, carrega os dados, e
  // só depois checa permissão". Um TECNICO tentando abrir o atendimento de
  // outro (id de outra pessoa digitado direto na URL) recebe exatamente a
  // mesma resposta 404 de "não existe" — nada nos dados do atendimento
  // chega a ser carregado nem exposto nesse caso.
  const ticket = await prisma.supportTicket.findFirst({
    where: { AND: [{ id }, criarFiltroDeAcessoAtendimentos(usuario)] },
    include: { colaborador: true },
  });
  if (!ticket) notFound();

  // Inclui o colaborador atualmente vinculado mesmo que já esteja inativo,
  // para não "sumir" da seleção ao editar um atendimento antigo.
  const colaboradores = await prisma.colaborador.findMany({
    where: ticket.colaboradorId ? { OR: [{ status: "ativo" }, { id: ticket.colaboradorId }] } : { status: "ativo" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cargo: true },
  });

  const dataAtendimentoValue = ticket.dataAtendimento.toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title={`Atendimento #${ticket.numero}`}
        description={`Registrado em ${ticket.createdAt.toISOString().slice(0, 10)} · Última atualização em ${ticket.updatedAt
          .toISOString()
          .slice(0, 10)}`}
        action={
          <span className={`badge ${badgeStatus[ticket.status] ?? "chip-neutral"}`}>
            {ticket.status}
          </span>
        }
      />

      {!ticket.colaboradorId && (ticket.liderNomeHistorico || ticket.equipeNomeHistorico) && (
        <div className="mb-6 rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 text-sm text-graphite-400">
          Atendimento registrado antes da reestruturação do Cadastro de Colaboradores.
          {ticket.liderNomeHistorico && <> Líder na época: <span className="text-graphite-200">{ticket.liderNomeHistorico}</span>.</>}
          {ticket.equipeNomeHistorico && <> Equipe na época: <span className="text-graphite-200">{ticket.equipeNomeHistorico}</span>.</>}
        </div>
      )}

      <form action={updateTicket} className="card">
        <input type="hidden" name="id" value={ticket.id} />
        <fieldset disabled={!podeEditar} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field">Data</label>
            <input
              name="data_atendimento"
              type="date"
              required
              defaultValue={dataAtendimentoValue}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <TempoAtendimentoInputs
              horaInicioDefault={ticket.horaInicio}
              horaFimDefault={ticket.horaFim ?? ""}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="label-field">Colaborador</label>
            <select name="colaborador_id" className="input-field" defaultValue={ticket.colaboradorId ?? ""}>
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
            <input name="projeto" defaultValue={ticket.projeto ?? ""} className="input-field" />
          </div>
          <div>
            <label className="label-field">Cliente</label>
            <input name="cliente" defaultValue={ticket.cliente ?? ""} className="input-field" />
          </div>
          <div>
            <label className="label-field">Site</label>
            <input
              name="site"
              maxLength={30}
              defaultValue={ticket.site ?? ""}
              className="input-field"
              placeholder="Ex.: SN-AQDIK4"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field">Tipo de atendimento</label>
            <select name="tipo_atendimento" required className="input-field" defaultValue={ticket.tipoAtendimento}>
              {TIPOS_ATENDIMENTO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Resultado</label>
            <select name="resultado" required className="input-field" defaultValue={ticket.resultado}>
              {RESULTADOS_SUPORTE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select name="status" required className="input-field" defaultValue={ticket.status}>
              {STATUS_SUPORTE.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="label-field mb-1">Categoria do atendimento</p>
          {!ticket.categoriaPrincipal && (
            <div className="mb-3 rounded-lg border border-amber-700/40 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
              <span className="font-semibold">Categoria legada:</span> {ticket.categoria}
              <p className="mt-1 text-xs text-amber-200/70">
                Este atendimento foi registrado antes da classificação hierárquica existir. O valor acima é
                preservado e continua sendo exibido normalmente. Para reclassificar, selecione uma Categoria
                Principal abaixo e salve — caso contrário, esta categoria legada permanece inalterada.
              </p>
            </div>
          )}
          <SeletorCategoriaSuporte
            categoriaPrincipalDefault={ticket.categoriaPrincipal ?? ""}
            subcategoriaDefault={ticket.subcategoria ?? ""}
            detalhamentoDefault={ticket.detalhamento ?? ""}
          />
        </div>

        <div>
          <label className="label-field">Descrição do problema</label>
          <textarea
            name="descricao_problema"
            required
            rows={3}
            defaultValue={ticket.descricaoProblema}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">Solução aplicada</label>
          <textarea
            name="solucao_aplicada"
            rows={3}
            defaultValue={ticket.solucaoAplicada ?? ""}
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Técnico responsável</label>
            <input
              name="tecnico_responsavel"
              defaultValue={ticket.tecnicoResponsavel ?? ""}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Observações</label>
            <input name="observacoes" defaultValue={ticket.observacoes ?? ""} className="input-field" />
          </div>
        </div>

        <div className="flex justify-end border-t border-graphite-800 pt-4">
          <button type="submit" className="btn-primary">Salvar alterações</button>
        </div>
        </fieldset>
      </form>

      {(podeEncerrar || podeExcluir) && (
        <div className="mt-4 flex justify-end gap-3">
          {podeEncerrar && (
            <form action={closeTicket}>
              <input type="hidden" name="id" value={ticket.id} />
              <button type="submit" className="btn-secondary" disabled={ticket.status === "Finalizado"}>
                Encerrar atendimento
              </button>
            </form>
          )}
          {/* Exclusão é uma ação administrativa sensível — só ADMIN (ver lib/autorizacao.ts). */}
          {podeExcluir && (
            <form action={deleteTicket}>
              <input type="hidden" name="id" value={ticket.id} />
              <button type="submit" className="btn-danger">Excluir</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
