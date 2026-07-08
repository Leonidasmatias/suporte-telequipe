"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  analisarWorkbookColaboradores,
  calcularNomeNormalizado,
  compararComBancoColaboradores,
  sincronizarColaboradores,
  type ColaboradorImportado,
  type RelatorioSincronizacao,
  type ResultadoAnaliseColaboradores,
} from "@/lib/colaboradores";

function revalidarTudo() {
  revalidatePath("/colaboradores");
  revalidatePath("/importacao");
  revalidatePath("/home");
  revalidatePath("/matriz-nokia");
  revalidatePath("/insights-operacionais");
  revalidatePath("/suporte");
}

/** Lê o arquivo enviado, faz o parsing e compara com o Cadastro Mestre (novo x atualização x sem alteração). Não grava nada ainda. */
export async function analisarPlanilhaColaboradores(formData: FormData): Promise<ResultadoAnaliseColaboradores> {
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return {
      arquivoNome: "",
      totalLinhas: 0,
      pessoas: [],
      novos: 0,
      atualizacoes: 0,
      semAlteracao: 0,
      comErro: 0,
      errosGlobais: ["Nenhum arquivo enviado."],
      avisosGlobais: [],
      podeConfirmar: false,
    };
  }

  const arrayBuffer = await arquivo.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let resultado: ResultadoAnaliseColaboradores;
  try {
    resultado = analisarWorkbookColaboradores(buffer, arquivo.name);
  } catch {
    return {
      arquivoNome: arquivo.name,
      totalLinhas: 0,
      pessoas: [],
      novos: 0,
      atualizacoes: 0,
      semAlteracao: 0,
      comErro: 0,
      errosGlobais: ["Não foi possível ler este arquivo. Confirme que é uma planilha .xlsx válida."],
      avisosGlobais: [],
      podeConfirmar: false,
    };
  }

  if (resultado.pessoas.length === 0) return resultado;

  const pessoasComparadas = await compararComBancoColaboradores(resultado.pessoas);
  const novos = pessoasComparadas.filter((p) => p.status === "novo").length;
  const atualizacoes = pessoasComparadas.filter((p) => p.status === "atualizacao").length;
  const semAlteracao = pessoasComparadas.filter((p) => p.status === "sem_alteracao").length;

  return { ...resultado, pessoas: pessoasComparadas, novos, atualizacoes, semAlteracao };
}

export type ConfirmarSincronizacaoResultado =
  | { ok: true; relatorio: RelatorioSincronizacao }
  | { ok: false; erro: string };

/** Executa o Smart Sync: grava no Cadastro Mestre (insere/atualiza/inativa) e retorna o relatório final. */
export async function confirmarSincronizacao(pessoas: ColaboradorImportado[]): Promise<ConfirmarSincronizacaoResultado> {
  if (!pessoas || pessoas.length === 0) {
    return { ok: false, erro: "Nenhum colaborador para sincronizar." };
  }

  try {
    const relatorio = await sincronizarColaboradores(pessoas);
    revalidarTudo();
    return { ok: true, relatorio };
  } catch (e) {
    console.error("Erro ao sincronizar Cadastro Mestre de Colaboradores:", e);
    return {
      ok: false,
      erro: "Erro ao gravar no banco. Como a operação roda em uma transação, nenhum dado foi salvo.",
    };
  }
}

// ---------------------------------------------------------------
// Cadastro manual pontual (correções/inclusões avulsas fora do Excel)
// ---------------------------------------------------------------

export async function createColaborador(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const tipoPessoa = String(formData.get("tipo_pessoa") || "").trim();
  const regional = String(formData.get("regional") || "").trim();
  const operadoras = String(formData.get("operadoras") || "").trim();
  const empresaNome = String(formData.get("empresa_nome") || "").trim();
  const cargo = String(formData.get("cargo") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const status = String(formData.get("status") || "ativo");

  if (!nome) return;

  const agora = new Date();

  try {
    await prisma.colaborador.create({
      data: {
        nome,
        nomeNormalizado: calcularNomeNormalizado(nome),
        tipoPessoa: tipoPessoa || null,
        regional: regional || null,
        operadoras: operadoras || null,
        empresaNome: empresaNome || null,
        cargo: cargo || null,
        telefone: telefone || null,
        status,
        ultimaAtualizacao: agora,
      },
    });
  } catch (e) {
    // P2002 = violação de unicidade em nomeNormalizado: já existe um
    // colaborador com esse mesmo nome (a chave de identificação do Smart
    // Sync). Silencioso de propósito — o formulário não tem um canal de
    // erro dedicado hoje; a listagem simplesmente não ganha um duplicado.
    console.error("Erro ao criar colaborador (possível nome duplicado):", e);
  }

  revalidatePath("/colaboradores");
  revalidatePath("/home");
}

export async function updateColaborador(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const nome = String(formData.get("nome") || "").trim();
  const tipoPessoa = String(formData.get("tipo_pessoa") || "").trim();
  const regional = String(formData.get("regional") || "").trim();
  const operadoras = String(formData.get("operadoras") || "").trim();
  const empresaNome = String(formData.get("empresa_nome") || "").trim();
  const cargo = String(formData.get("cargo") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const status = String(formData.get("status") || "ativo");

  if (!nome) return;

  try {
    await prisma.colaborador.update({
      where: { id },
      data: {
        nome,
        nomeNormalizado: calcularNomeNormalizado(nome),
        tipoPessoa: tipoPessoa || null,
        regional: regional || null,
        operadoras: operadoras || null,
        empresaNome: empresaNome || null,
        cargo: cargo || null,
        telefone: telefone || null,
        status,
        ultimaAtualizacao: new Date(),
      },
    });
  } catch (e) {
    console.error("Erro ao atualizar colaborador (possível nome duplicado):", e);
  }

  revalidatePath("/colaboradores");
  revalidatePath("/home");
}

/** Alterna o status do colaborador entre "ativo" e "inativo" em um clique, sem precisar abrir um formulário de edição. */
export async function toggleColaboradorStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const atual = await prisma.colaborador.findUnique({ where: { id }, select: { status: true } });
  if (!atual) return;

  const novoStatus = atual.status === "ativo" ? "inativo" : "ativo";
  await prisma.colaborador.update({
    where: { id },
    data: { status: novoStatus, ultimaAtualizacao: new Date() },
  });

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
  revalidatePath("/home");
  revalidatePath("/suporte");
  revalidatePath("/suporte/novo");
}

export async function deleteColaborador(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.colaborador.delete({ where: { id } });
  revalidatePath("/colaboradores");
  revalidatePath("/home");
}
