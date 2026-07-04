"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createEquipe(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const regional = String(formData.get("regional") || "").trim();
  const liderIdRaw = String(formData.get("lider_id") || "");
  const liderId = liderIdRaw ? Number(liderIdRaw) : null;

  if (!nome) return;

  db.prepare(`INSERT INTO equipes (nome, regional, lider_id) VALUES (?, ?, ?)`).run(
    nome,
    regional,
    liderId
  );

  revalidatePath("/equipes");
  revalidatePath("/home");
}

export async function deleteEquipe(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM equipes WHERE id = ?").run(id);
  revalidatePath("/equipes");
  revalidatePath("/home");
}
