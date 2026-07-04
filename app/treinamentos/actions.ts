"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createTreinamento(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const cargaHoraria = Number(formData.get("carga_horaria") || 0);
  const dataRealizacao = String(formData.get("data_realizacao") || "");
  const instrutor = String(formData.get("instrutor") || "").trim();

  if (!nome) return;

  db.prepare(
    `INSERT INTO treinamentos (nome, categoria, carga_horaria, data_realizacao, instrutor)
     VALUES (?, ?, ?, ?, ?)`
  ).run(nome, categoria, cargaHoraria || null, dataRealizacao || null, instrutor);

  revalidatePath("/treinamentos");
  revalidatePath("/home");
}

export async function deleteTreinamento(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM treinamentos WHERE id = ?").run(id);
  revalidatePath("/treinamentos");
  revalidatePath("/home");
}
