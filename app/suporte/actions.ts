"use server";

import { prisma } from "@/lib/prisma";
import { calcularTempoAtendimento } from "@/lib/suporte";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { garantirModoEdicao } from "@/lib/auth";

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
  garantirModoEdicao();

  const dataAtendimentoRaw = campoTexto(formData, "data_atendimento");
  const horaInicio = campoTexto(formData, "hora_inicio");
  const horaFim = campoOpcional(formData, "hora_fim");
  const colaboradorId = campoIdOpcional(formData, "colaborador_id");
  const projeto = campoOpcional(formData, "projeto");
  const cliente = campoOpcional(formData, "cliente");
  const tipoAtendimento = campoTexto(formData, "tipo_atendimento");
  const categoria = campoTexto(formData, "categoria");
  const descricaoProblema = campoTexto(formData, "descricao_problema");
  const solucaoAplicada = campoOpcional(formData, "solucao_aplicada");
  const resultado = campoTexto(formData, "resultado");
  const status = campoTexto(formData, "status") || "Aberto";
  const observacoes = campoOpcional(formData, "observacoes");
  const tecnicoResponsavel = campoOpcional(formData, "tecnico_responsavel");

  if (!dataAtendimentoRaw || !horaInicio || !tipoAtendimento || !categoria || !descricaoProblema || !resultado) {
    return;
  }

  const tempoAtendimento = calcularTempoAtendimento(horaInicio, horaFim);

  const ticket = await prisma.supportTicket.create({
    data: {
      dataAtendimento: new Date(dataAtendimentoRaw),
      horaInicio,
      horaFim,
      tempoAtendimento,
      colaboradorId,
      projeto,
      cliente,
      tipoAtendimento,
      categoria,
      descricaoProblema,
      solucaoAplicada,
      resultado,
      status,
      observacoes,
      tecnicoResponsavel,
    },
  });

  revalidatePath("/suporte");
  revalidatePath("/relatorios/suporte");
  if (colaboradorId) revalidatePath(`/colaboradores/${colaboradorId}`);

  redirect(`/suporte/${ticket.id}`);
}

export async function updateTicket(formData: FormData) {
  garantirModoEdicao();

  const id = Number(formData.get("id"));
  if (!id) return;

  const dataAtendimentoRaw = campoTexto(formData, "data_atendimento");
  const horaInicio = campoTexto(formData, "hora_inicio");
  const horaFim = campoOpcional(formData, "hora_fim");
  const colaboradorId = campoIdOpcional(formData, "colaborador_id");
  const projeto = campoOpcional(formData, "projeto");
  const cliente = campoOpcional(formData, "cliente");
  const tipoAtendimento = campoTexto(formData, "tipo_atendimento");
  const categoria = campoTexto(formData, "categoria");
  const descricaoProblema = campoTexto(formData, "descricao_problema");
  const solucaoAplicada = campoOpcional(formData, "solucao_aplicada");
  const resultado = campoTexto(formData, "resultado");
  const status = campoTexto(formData, "status");
  const observacoes = campoOpcional(formData, "observacoes");
  const tecnicoResponsavel = campoOpcional(formData, "tecnico_responsavel");

  if (!dataAtendimentoRaw || !horaInicio || !tipoAtendimento || !categoria || !descricaoProblema || !resultado || !status) {
    return;
  }

  const tempoAtendimento = calcularTempoAtendimento(horaInicio, horaFim);

  await prisma.supportTicket.update({
    where: { id },
    data: {
      dataAtendimento: new Date(dataAtendimentoRaw),
      horaInicio,
      horaFim,
      tempoAtendimento,
      colaboradorId,
      projeto,
      cliente,
      tipoAtendimento,
      categoria,
      descricaoProblema,
      solucaoAplicada,
      resultado,
      status,
      observacoes,
      tecnicoResponsavel,
    },
  });

  revalidatePath("/suporte");
  revalidatePath(`/suporte/${id}`);
  revalidatePath("/relatorios/suporte");
  if (colaboradorId) revalidatePath(`/colaboradores/${colaboradorId}`);
}

/** Encerra rapidamente um atendimento (usado pelo botão "Encerrar atendimento" na tela de detalhes). */
export async function closeTicket(formData: FormData) {
  garantirModoEdicao();

  const id = Number(formData.get("id"));
  if (!id) return;

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status: "Finalizado" },
  });

  revalidatePath("/suporte");
  revalidatePath(`/suporte/${id}`);
  revalidatePath("/relatorios/suporte");
  if (ticket.colaboradorId) revalidatePath(`/colaboradores/${ticket.colaboradorId}`);
}

export async function deleteTicket(formData: FormData) {
  garantirModoEdicao();

  const id = Number(formData.get("id"));
  if (!id) return;

  const ticket = await prisma.supportTicket.delete({ where: { id } });

  revalidatePath("/suporte");
  revalidatePath("/relatorios/suporte");
  if (ticket.colaboradorId) revalidatePath(`/colaboradores/${ticket.colaboradorId}`);

  redirect("/suporte");
}
