"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ETAPAS, TREINAMENTO_SUGERIDO, type EtapaCodigo } from "@/lib/imt";
import { ACOES, requirePerformAction } from "@/lib/autorizacao";

const CODIGOS_VALIDOS = new Set<string>(ETAPAS.map((e) => e.codigo));

/**
 * Cria automaticamente um treinamento a partir de uma sugestão gerada
 * pelo motor de inteligência operacional (IMT < 70 em uma etapa Nokia)
 * e já vincula o colaborador correspondente.
 */
export async function criarTreinamentoSugerido(formData: FormData) {
  await requirePerformAction(ACOES["insights.escrever"]);

  const colaboradorId = Number(formData.get("colaborador_id"));
  const etapa = String(formData.get("etapa") || "");

  if (!colaboradorId || !CODIGOS_VALIDOS.has(etapa)) return;

  const titulo = TREINAMENTO_SUGERIDO[etapa as EtapaCodigo];

  const treinamento = await prisma.treinamento.create({
    data: {
      titulo,
      categoria: "Sugestão Automática (IMT)",
      cargaHoraria: 8,
    },
  });

  await prisma.treinamentoColaborador.create({
    data: {
      treinamentoId: treinamento.id,
      colaboradorId,
      status: "pendente",
    },
  });

  revalidatePath("/treinamentos");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}
