"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { garantirModoEdicao } from "@/lib/auth";

export async function createTreinamento(formData: FormData) {
  garantirModoEdicao();

  const titulo = String(formData.get("nome") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const cargaHorariaRaw = Number(formData.get("carga_horaria") || 0);
  const dataRaw = String(formData.get("data_realizacao") || "");
  const instrutor = String(formData.get("instrutor") || "").trim();

  if (!titulo) return;

  await prisma.treinamento.create({
    data: {
      titulo,
      categoria: categoria || null,
      cargaHoraria: cargaHorariaRaw || null,
      data: dataRaw ? new Date(dataRaw) : null,
      instrutor: instrutor || null,
    },
  });

  revalidatePath("/treinamentos");
  revalidatePath("/home");
}

export async function deleteTreinamento(formData: FormData) {
  garantirModoEdicao();

  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.treinamento.delete({ where: { id } });
  revalidatePath("/treinamentos");
  revalidatePath("/home");
}
