import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import TempoAtendimentoInputs from "@/components/TempoAtendimentoInputs";
import SeletorCategoriaSuporte from "@/components/SeletorCategoriaSuporte";
import SeletorProjetoRegional from "@/components/SeletorProjetoRegional";
import { updateTicket, closeTicket, deleteTicket } from "../actions";
import { TIPOS_ATENDIMENTO, RESULTADOS_SUPORTE, STATUS_SUPORTE } from "@/lib/suporte";
import { obterClassificacaoAtualValida } from "@/lib/categoriasSuporte";
import { normalizarProjeto, normalizarRegional } from "@/lib/projetoRegional";
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

  // Missão v7.1 (revisão da matriz hierárquica — Projeto → Categoria
  // Principal → Subcategoria → Detalhamento): um atendimento pode ter
  // `categoriaPrincipal` preenchido com um valor que não é decodificável
  // contra a matriz ATUAL — nunca classificado, classificado por uma matriz
  // anterior (3 níveis, sem Projeto, ex.: "MOS" sozinho), ou por qualquer
  // formato ainda mais antigo (ex.: "3 - ATIVAÇÃO"). Em todos esses casos o
  // tratamento na tela é o mesmo: mostrar o valor salvo como legado, sem
  // tentar pré-selecionar nada no seletor novo (que só lista Projetos/
  // Categorias da matriz atual) e sem alterar nada no banco. Editar sem
  // tocar no seletor preserva esse valor legado intacto (ver updateTicket em
  // app/suporte/actions.ts).
  const classificacaoAtual = obterClassificacaoAtualValida(ticket);
  const categoriaAtualValida = classificacaoAtual !== null;

  // Missão "TELEQUIPE SUPORTE STA — Evolução 7.1": `ticket.projeto` pode ser
  // texto livre legado (ex.: "Expansão 5G Regional Sul", registrado antes
  // desta missão) que não corresponde a nenhum dos 7 Projetos oficiais da
  // matriz Projeto x Regional. Nesse caso, o <select> abaixo não deve tentar
  // pré-selecionar um valor que não existe entre suas opções — passamos
  // string vazia (equivalente a "categoria legada" em
  // SeletorCategoriaSuporte), preservando o valor legado 100% intacto no
  // banco (nada é sobrescrito a menos que o usuário escolha um Projeto
  // oficial e salve).
  const projetoOficialAtual = normalizarProjeto(ticket.projeto) ?? "";
  const regionalAtual = projetoOficialAtual ? normalizarRegional(ticket.regional) ?? "" : "";

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
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

        {/* Missão "Unificação visual Projeto/Regional no bloco Categoria do
            atendimento": Projeto e Regional (matriz oficial, ver
            lib/projetoRegional.ts) foram trazidos para dentro deste mesmo
            bloco, antes da Categoria/Subcategoria/Detalhamento, na ordem
            exigida — sem duplicar os campos e sem alterar a validação de
            nenhum dos dois (ambas continuam em app/suporte/actions.ts,
            inalteradas). O aviso de "Categoria legada" mantém a mesma
            posição relativa: imediatamente antes de SeletorCategoriaSuporte. */}
        <div className="rounded-lg border border-graphite-800 p-4">
          <p className="label-field mb-1">Categoria do atendimento</p>
          <p className="mb-4 text-xs text-graphite-500">
            Selecione primeiro o Projeto e a Regional para depois informar a Categoria, Subcategoria e Detalhamento.
          </p>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SeletorProjetoRegional projetoDefault={projetoOficialAtual} regionalDefault={regionalAtual} />
          </div>
          {!categoriaAtualValida && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Categoria legada:</span> {ticket.categoria}
              <p className="mt-1 text-xs text-amber-700/80">
                {ticket.categoriaPrincipal
                  ? "Este atendimento foi classificado em uma estrutura de categorias anterior, que foi substituída. O valor acima é preservado e continua sendo exibido normalmente."
                  : "Este atendimento foi registrado antes da classificação hierárquica existir. O valor acima é preservado e continua sendo exibido normalmente."}{" "}
                Para reclassificar, selecione uma Categoria Principal abaixo e salve — caso contrário, esta
                categoria legada permanece inalterada.
              </p>
            </div>
          )}
          <SeletorCategoriaSuporte
            categoriaPrincipalDefault={classificacaoAtual?.categoriaPrincipal ?? ""}
            subcategoriaDefault={classificacaoAtual?.subcategoria ?? ""}
            detalhamentoDefault={classificacaoAtual?.detalhamento ?? ""}
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
