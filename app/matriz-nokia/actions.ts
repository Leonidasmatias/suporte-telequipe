"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ETAPAS } from "@/lib/imt";
import { ACOES, requirePerformAction } from "@/lib/autorizacao";

const CODIGOS_VALIDOS = new Set<string>(ETAPAS.map((e) => e.codigo));

export async function createAvaliacao(formData: FormData) {
  await requirePerformAction(ACOES["matrizNokia.escrever"]);

  const colaboradorId = Number(formData.get("colaborador_id"));
  const etapa = String(formData.get("etapa") || "");
  const nivel = String(formData.get("nivel") || "Não certificado");
  const imtScore = Number(formData.get("imt_score") || 0);
  const dataAvaliacaoRaw = String(formData.get("data_avaliacao") || "");

  if (!colaboradorId || !CODIGOS_VALIDOS.has(etapa)) return;

  // Garante que a competência (etapa Nokia) já exista como linha fixa —
  // resiliente mesmo se o seed ainda não tiver sido executado.
  const competencia = await prisma.competenciaNokia.upsert({
    where: { nome: etapa },
    update: {},
    create: { nome: etapa },
  });

  await prisma.avaliacaoCompetencia.create({
    data: {
      colaboradorId,
      competenciaId: competencia.id,
      nota: imtScore,
      nivel,
      avaliadoEm: dataAvaliacaoRaw ? new Date(dataAvaliacaoRaw) : null,
    },
  });

  revalidatePath("/matriz-nokia");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}

export async function deleteAvaliacao(formData: FormData) {
  await requirePerformAction(ACOES["matrizNokia.escrever"]);

  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.avaliacaoCompetencia.delete({ where: { id } });
  revalidatePath("/matriz-nokia");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}
