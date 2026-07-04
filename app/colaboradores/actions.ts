"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createColaborador(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const funcao = String(formData.get("funcao") || "").trim();
  const equipeIdRaw = String(formData.get("equipe_id") || "");
  const equipeId = equipeIdRaw ? Number(equipeIdRaw) : null;
  const telefone = String(formData.get("telefone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const status = String(formData.get("status") || "ativo");
  const dataAdmissao = String(formData.get("data_admissao") || "");

  if (!nome) return;

  db.prepare(
    `INSERT INTO colaboradores (nome, funcao, equipe_id, telefone, email, status, data_admissao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nome, funcao, equipeId, telefone, email, status, dataAdmissao || null);

  revalidatePath("/colaboradores");
  revalidatePath("/home");
}

export async function deleteColaborador(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM colaboradores WHERE id = ?").run(id);
  revalidatePath("/colaboradores");
  revalidatePath("/home");
}
