"use server";

import { prisma } from "@/lib/prisma";
import { calcularTempoAtendimento, normalizarSite } from "@/lib/suporte";
import {
  validarClassificacaoSuporte,
  formatarCategoriaHierarquica,
} from "@/lib/categoriasSuporte";
import { validarProjetoRegional } from "@/lib/projetoRegional";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACOES, requirePerformAction, criarFiltroDeAcessoAtendimentos } from "@/lib/autorizacao";

function campoTexto(formData: FormData, nome: string): string {
  return String(formData.get(nome) || "").trim();
}

function campoOpcional(formData: FormData, nome: string): string | null {
  const valor = campoTexto(formData, nome);
  return valor || null;
}

function campoIdOpcional(formData: FormData, nome: string): number | null {
  const valor = campoTexto(formData, nome);
  return valor ? Number(valor) : null;
}

export async function createTicket(formData: FormData) {
  const usuario = await requirePerformAction(ACOES["atendimentos.criar"]);

  const dataAtendimentoRaw = campoTexto(formData, "data_atendimento");
  const horaInicio = campoTexto(formData, "hora_inicio");
  const horaFim = campoOpcional(formData, "hora_fim");
  const colaboradorId = campoIdOpcional(formData, "colaborador_id");
  // Missão "TELEQUIPE SUPORTE STA — Evolução 7.1": `projeto` agora vem de um
  // <select> com os 7 Projetos oficiais da matriz Projeto x Regional (ver
  // lib/projetoRegional.ts e components/SeletorProjetoRegional.tsx), em vez
  // do <input> de texto livre anterior. `regional` é um campo NOVO,
  // validado contra o Projeto escolhido logo abaixo.
  const projeto = campoOpcional(formData, "projeto");
  const regional = campoOpcional(formData, "regional");
  const cliente = campoOpcional(formData, "cliente");
  const site = normalizarSite(campoOpcional(formData, "site"));
  const tipoAtendimento = campoTexto(formData, "tipo_atendimento");
  // Missão "Refatoração da Categoria do Atendimento — eliminação do campo
  // Projeto duplicado" (v7.3): "categoria_projeto" não existe mais — a
  // hierarquia de categorias passou a ter Categoria Principal como topo,
  // sem nenhum nível de Projeto (ver lib/categoriasSuporte.ts).
  const categoriaPrincipal = campoOpcional(formData, "categoria_principal");
  const subcategoria = campoOpcional(formData, "subcategoria");
  const detalhamento = campoOpcional(formData, "detalhamento");
  const descricaoProblema = campoTexto(formData, "descricao_problema");
  const solucaoAplicada = campoOpcional(formData, "solucao_aplicada");
  const resultado = campoTexto(formData, "resultado");
  const status = campoTexto(formData, "status") || "Aberto";
  const observacoes = campoOpcional(formData, "observacoes");
  const tecnicoResponsavel = campoOpcional(formData, "tecnico_responsavel");

  // Projeto e Categoria Principal são obrigatórios na criação
  // (Subcategoria/Detalhamento continuam opcionais — nem toda categoria os
  // possui, ver lib/categoriasSuporte.ts). Combinações fora da estrutura
  // oficial (ex.: Projeto "IEZ" com Categoria Principal "Ativação", que só
  // existe nos projetos de campo) são rejeitadas aqui, no servidor — nunca
  // confiamos apenas na cascata do formulário no cliente.
  if (
    !dataAtendimentoRaw ||
    !horaInicio ||
    !tipoAtendimento ||
    !categoriaPrincipal ||
    !descricaoProblema ||
    !resultado
  ) {
    return;
  }
  const validacaoCategoria = validarClassificacaoSuporte({
    categoriaPrincipal,
    subcategoria,
    detalhamento,
  });
  if (!validacaoCategoria.valido) return;

  // Validação da relação oficial Projeto x Regional (missão "Evolução 7.1").
  // Não confiamos apenas na cascata do formulário no cliente — uma chamada
  // direta à API (ignorando o <select>) que tente uma combinação inválida é
  // rejeitada aqui, no servidor.
  const validacaoProjetoRegional = validarProjetoRegional(projeto, regional);
  if (!validacaoProjetoRegional.valido) {
    throw new Error(validacaoProjetoRegional.erro);
  }

  // Campo legado `categoria` (obrigatório no banco) recebe o texto formatado
  // dos 4 níveis, para continuar pesquisável/exibível por quem só usa esse
  // campo (relatórios antigos, etc).
  const categoria = formatarCategoriaHierarquica({
    categoriaPrincipal,
    subcategoria,
    detalhamento,
  });
  // Missão v7.3: sem nível de Projeto para codificar, `categoriaPrincipal`
  // grava diretamente o nome da Categoria Principal escolhida (ver
  // lib/categoriasSuporte.ts) — nenhuma migration exigida.
  const categoriaPrincipalPersistida = categoriaPrincipal;

  const tempoAtendimento = calcularTempoAtendimento(horaInicio, horaFim);

  const ticket = await prisma.supportTicket.create({
    data: {
      dataAtendimento: new Date(dataAtendimentoRaw),
      horaInicio,
      horaFim,
      tempoAtendimento,
      colaboradorId,
      projeto,
      regional,
      cliente,
      site,
      tipoAtendimento,
      categoria,
      categoriaPrincipal: categoriaPrincipalPersistida,
      subcategoria,
      detalhamento,
      descricaoProblema,
      solucaoAplicada,
      resultado,
      status,
      observacoes,
      tecnicoResponsavel,
      // Vínculo real de propriedade (missão "Controle de visualização e
      // exportação por perfil") — sempre a sessão autenticada de quem está
      // criando o atendimento AGORA, nunca um campo vindo do formulário/URL.
      // É este campo (não `tecnicoResponsavel`, texto livre) que decide o que
      // um TECNICO pode ver/editar/exportar depois.
      usuarioResponsavelId: usuario.id,
    },
  });

  revalidatePath("/suporte");
  revalidatePath("/relatorios/suporte");
  if (colaboradorId) revalidatePath(`/colaboradores/${colaboradorId}`);

  redirect(`/suporte/${ticket.id}`);
}

export async function updateTicket(formData: FormData) {
  const usuario = await requirePerformAction(ACOES["atendimentos.editar"]);

  const id = Number(formData.get("id"));
  if (!id) return;

  const dataAtendimentoRaw = campoTexto(formData, "data_atendimento");
  const horaInicio = campoTexto(formData, "hora_inicio");
  const horaFim = campoOpcional(formData, "hora_fim");
  const colaboradorId = campoIdOpcional(formData, "colaborador_id");
  // Ver nota equivalente em createTicket: `projeto` agora vem do <select>
  // com os 7 Projetos oficiais (lib/projetoRegional.ts); `regional` é novo.
  const projeto = campoOpcional(formData, "projeto");
  const regional = campoOpcional(formData, "regional");
  const cliente = campoOpcional(formData, "cliente");
  const site = normalizarSite(campoOpcional(formData, "site"));
  const tipoAtendimento = campoTexto(formData, "tipo_atendimento");
  // Missão v7.3: "categoria_projeto" não existe mais (ver nota equivalente
  // em createTicket) — Categoria Principal é o topo da hierarquia de
  // categorias, sem nenhum nível de Projeto.
  const categoriaPrincipal = campoOpcional(formData, "categoria_principal");
  const subcategoria = campoOpcional(formData, "subcategoria");
  const detalhamento = campoOpcional(formData, "detalhamento");
  const descricaoProblema = campoTexto(formData, "descricao_problema");
  const solucaoAplicada = campoOpcional(formData, "solucao_aplicada");
  const resultadoAtendimento = campoTexto(formData, "resultado");
  const status = campoTexto(formData, "status");
  const observacoes = campoOpcional(formData, "observacoes");
  const tecnicoResponsavel = campoOpcional(formData, "tecnico_responsavel");

  if (!dataAtendimentoRaw || !horaInicio || !tipoAtendimento || !descricaoProblema || !resultadoAtendimento || !status) {
    return;
  }

  // Classificação hierárquica na edição é opcional por design: se o usuário
  // deixar "Categoria Principal" em branco, NÃO tocamos em nenhum dos 4
  // campos de categoria (`categoria`/`categoriaPrincipal`/`subcategoria`/
  // `detalhamento`) — preserva tanto uma classificação hierárquica já salva
  // quanto um atendimento antigo só com o `categoria` legado. Só
  // substituímos a classificação quando o usuário efetivamente escolhe uma
  // nova Categoria Principal e salva (missão v7.3: Categoria Principal é
  // agora o topo da hierarquia, já que o nível "Projeto" foi eliminado
  // daqui).
  let dadosCategoria: {
    categoria?: string;
    categoriaPrincipal?: string | null;
    subcategoria?: string | null;
    detalhamento?: string | null;
  } = {};

  if (categoriaPrincipal) {
    const validacaoCategoria = validarClassificacaoSuporte({
      categoriaPrincipal,
      subcategoria,
      detalhamento,
    });
    if (!validacaoCategoria.valido) return;

    dadosCategoria = {
      categoria: formatarCategoriaHierarquica({
        categoriaPrincipal,
        subcategoria,
        detalhamento,
      }),
      categoriaPrincipal,
      subcategoria,
      detalhamento,
    };
  }

  // Validação da relação oficial Projeto x Regional (missão "Evolução
  // 7.1") — igual à de createTicket, nunca confiando apenas no <select> do
  // cliente.
  const validacaoProjetoRegional = validarProjetoRegional(projeto, regional);
  if (!validacaoProjetoRegional.valido) {
    throw new Error(validacaoProjetoRegional.erro);
  }

  // Projeto/Regional na edição seguem a MESMA filosofia já aplicada à
  // classificação hierárquica acima: um atendimento antigo pode ter
  // `projeto` como texto livre legado (fora da matriz oficial), que o
  // <select> de SeletorProjetoRegional não consegue pré-selecionar — nesse
  // caso o campo chega vazio no formData mesmo sem o usuário ter "limpado"
  // nada de propósito. Para nunca sobrescrever automaticamente esse valor
  // legado (ou uma classificação oficial já salva anteriormente), só
  // incluímos `projeto`/`regional` na escrita quando o usuário efetivamente
  // escolhe um Projeto oficial no <select> e salva.
  let dadosProjetoRegional: { projeto?: string | null; regional?: string | null } = {};
  if (projeto) {
    dadosProjetoRegional = { projeto, regional };
  }

  const tempoAtendimento = calcularTempoAtendimento(horaInicio, horaFim);

  // A restrição de propriedade já entra NA PRÓPRIA consulta de escrita — não
  // buscamos o atendimento primeiro para só depois checar se pertence ao
  // usuário. Um TECNICO tentando editar o atendimento de outro (id de outra
  // pessoa, digitado direto na URL/formulário) simplesmente não casa com
  // nenhuma linha (`count === 0`); a Server Action não altera nada e não
  // revela se o id existe ou não.
  const resultadoUpdate = await prisma.supportTicket.updateMany({
    where: { AND: [{ id }, criarFiltroDeAcessoAtendimentos(usuario)] },
    data: {
      dataAtendimento: new Date(dataAtendimentoRaw),
      horaInicio,
      horaFim,
      tempoAtendimento,
      colaboradorId,
      ...dadosProjetoRegional,
      cliente,
      site,
      tipoAtendimento,
      ...dadosCategoria,
      descricaoProblema,
      solucaoAplicada,
      resultado: resultadoAtendimento,
      status,
      observacoes,
      tecnicoResponsavel,
    },
  });
  if (resultadoUpdate.count === 0) return;

  revalidatePath("/suporte");
  revalidatePath(`/suporte/${id}`);
  revalidatePath("/relatorios/suporte");
  if (colaboradorId) revalidatePath(`/colaboradores/${colaboradorId}`);
}

/** Encerra rapidamente um atendimento (usado pelo botão "Encerrar atendimento" na tela de detalhes). */
export async function closeTicket(formData: FormData) {
  const usuario = await requirePerformAction(ACOES["atendimentos.encerrar"]);

  const id = Number(formData.get("id"));
  if (!id) return;

  // Mesma regra de propriedade da edição: só enxergamos/alteramos o
  // atendimento se ele estiver dentro do escopo do usuário logado. A leitura
  // abaixo já é filtrada pelo escopo (nunca carrega dados de um atendimento
  // fora dele) — só depois de confirmado é que a atualização acontece pelo
  // id único (já sabemos, nesse ponto, que pertence ao usuário).
  const ticketNoEscopo = await prisma.supportTicket.findFirst({
    where: { AND: [{ id }, criarFiltroDeAcessoAtendimentos(usuario)] },
    select: { id: true, colaboradorId: true },
  });
  if (!ticketNoEscopo) return; // não existe OU não pertence a este usuário — mesma resposta para os dois casos, sem vazar qual.

  await prisma.supportTicket.update({
    where: { id: ticketNoEscopo.id },
    data: { status: "Finalizado" },
  });

  revalidatePath("/suporte");
  revalidatePath(`/suporte/${id}`);
  revalidatePath("/relatorios/suporte");
  if (ticketNoEscopo.colaboradorId) revalidatePath(`/colaboradores/${ticketNoEscopo.colaboradorId}`);
}

export async function deleteTicket(formData: FormData) {
  // Exclusão de atendimento é classificada como exclusão administrativa
  // sensível (não listada no acesso operacional do TECNICO) — admin-only.
  // O ADMIN tem escopo global (criarFiltroDeAcessoAtendimentos devolve {}),
  // então a checagem de escopo abaixo não muda o comportamento atual para
  // quem já podia excluir — é aplicada mesmo assim por consistência e defesa
  // em profundidade, caso a matriz de permissões mude no futuro.
  const usuario = await requirePerformAction(ACOES["atendimentos.excluir"]);

  const id = Number(formData.get("id"));
  if (!id) return;

  const ticketNoEscopo = await prisma.supportTicket.findFirst({
    where: { AND: [{ id }, criarFiltroDeAcessoAtendimentos(usuario)] },
    select: { id: true, colaboradorId: true },
  });
  if (!ticketNoEscopo) return;

  await prisma.supportTicket.delete({ where: { id: ticketNoEscopo.id } });

  revalidatePath("/suporte");
  revalidatePath("/relatorios/suporte");
  if (ticketNoEscopo.colaboradorId) revalidatePath(`/colaboradores/${ticketNoEscopo.colaboradorId}`);

  redirect("/suporte");
}
