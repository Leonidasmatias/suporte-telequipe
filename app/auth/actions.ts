"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { criarTokenSessao, senhaCorreta, COOKIE_EDICAO, SESSAO_MAX_AGE_SEGUNDOS } from "@/lib/auth";

export type DesbloquearResultado = { ok: true } | { ok: false; erro: string };

/** Valida a senha de edição e, se correta, grava o cookie de sessão assinado. */
export async function desbloquearEdicao(formData: FormData): Promise<DesbloquearResultado> {
  const senha = String(formData.get("senha") || "");

  if (!process.env.EDIT_PASSWORD) {
    return {
      ok: false,
      erro: "EDIT_PASSWORD não configurado no ambiente. Peça para configurar antes de usar o modo de edição.",
    };
  }

  if (!senhaCorreta(senha)) {
    return { ok: false, erro: "Senha incorreta." };
  }

  cookies().set(COOKIE_EDICAO, criarTokenSessao(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSAO_MAX_AGE_SEGUNDOS,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Trava a edição novamente (logout do modo de edição). */
export async function bloquearEdicao() {
  cookies().delete(COOKIE_EDICAO);
  revalidatePath("/", "layout");
}
