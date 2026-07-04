"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ETAPAS, TREINAMENTO_SUGERIDO, type EtapaCodigo } from "@/lib/imt";

const CODIGOS_VALIDOS = new Set<string>(ETAPAS.map((e) => e.codigo));

/**
 * Cria automaticamente um treinamento a partir de uma sugestão gerada
 * pelo motor de inteligência operacional (IMT < 70 em uma etapa Nokia)
 * e já vincula o colaborador correspondente.
 */
export async function criarTreinamentoSugerido(formData: FormData) {
  const colaboradorId = Number(formData.get("colaborador_id"));
  const etapa = String(formData.get("etapa") || "");

  if (!colaboradorId || !CODIGOS_VALIDOS.has(etapa)) return;

  const nome = TREINAMENTO_SUGERIDO[etapa as EtapaCodigo];

  const resultado = db
    .prepare(
      `INSERT INTO treinamentos (nome, categoria, carga_horaria, instrutor)
       VALUES (?, 'Sugestão Automática (IMT)', 8, NULL)`
    )
    .run(nome);

  db.prepare(
    `INSERT INTO treinamento_colaboradores (treinamento_id, colaborador_id, status)
     VALUES (?, ?, 'pendente')`
  ).run(resultado.lastInsertRowid, colaboradorId);

  revalidatePath("/treinamentos");
  revalidatePath("/home");
  revalidatePath("/insights-operacionais");
}
