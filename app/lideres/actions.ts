"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createLider(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const cargo = String(formData.get("cargo") || "").trim();
  const regional = String(formData.get("regional") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!nome) return;

  db.prepare(
    `INSERT INTO lideres (nome, cargo, regional, telefone, email) VALUES (?, ?, ?, ?, ?)`
  ).run(nome, cargo, regional, telefone, email);

  revalidatePath("/lideres");
  revalidatePath("/home");
}

export async function deleteLider(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM lideres WHERE id = ?").run(id);
  revalidatePath("/lideres");
  revalidatePath("/home");
}
