"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verificarSenha } from "@/lib/senha";
import { criarTokenSessao, COOKIE_SESSAO, SESSAO_MAX_AGE_SEGUNDOS } from "@/lib/auth";

export type EntrarResultado = { ok: true } | { ok: false; erro: string };

/**
 * Valida e-mail/senha contra o banco (Usuario) e, se corretos e a conta
 * estiver ativa, grava o cookie de sessão assinado. Mensagem de erro é
 * sempre a mesma genérica ("E-mail ou senha inválidos") tanto para e-mail
 * inexistente quanto para senha errada quanto para conta inativa — não dá
 * pra um atacante descobrir por tentativa se um e-mail existe no sistema ou
 * se só está desativado.
 */
export async function entrar(formData: FormData): Promise<EntrarResultado> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const senha = String(formData.get("senha") || "");

  if (!email || !senha) {
    return { ok: false, erro: "Informe e-mail e senha." };
  }

  const ERRO_GENERICO = "E-mail ou senha inválidos.";

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) {
    return { ok: false, erro: ERRO_GENERICO };
  }

  if (!verificarSenha(senha, usuario.senhaHash)) {
    return { ok: false, erro: ERRO_GENERICO };
  }

  cookies().set(COOKIE_SESSAO, criarTokenSessao(usuario.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSAO_MAX_AGE_SEGUNDOS,
  });

  redirect("/home");
}

/** Encerra a sessão (logout). */
export async function sair() {
  cookies().delete(COOKIE_SESSAO);
  redirect("/login");
}
