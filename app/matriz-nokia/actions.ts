"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ETAPAS, type EtapaCodigo } from "@/lib/imt";

const CODIGOS_VALIDOS = new Set<string>(ETAPAS.map((e) => e.codigo));

export async function createAvaliacao(formData: FormData) {
  const colaboradorId = Number(formData.get("colaborador_id"));
  const etapa = String(formData.get("etapa") || "");
  const nivel = String(formData.get("nivel") || "Não certificado");
  const imtScore = Number(formData.get("imt_score") || 0);
  const dataAvaliacao = String(formData.get("data_avaliacao") || "");

  if (!colaboradorId || !CODIGOS_VALIDOS.has(etapa)) return;

  db.prepare(
    `INSERT INTO matriz_nokia (colaborador_id, etapa, nivel, imt_score, data_avaliacao)
     VALUES (?, ?, ?, ?, ?)`
  ).run(colaboradorId, etapa as EtapaCodigo, nivel, imtScore, dataAvaliacao || null);

  revalidatePath("/matriz-nokia");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}

export async function deleteAvaliacao(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM matriz_nokia WHERE id = ?").run(id);
  revalidatePath("/matriz-nokia");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}
