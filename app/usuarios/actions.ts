"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashSenha, senhaAtendeRequisitosMinimos } from "@/lib/senha";
import { requireAdminAction } from "@/lib/autorizacao";
import type { Perfil } from "@/lib/auth";

/**
 * Etapa 2 — Gestão de Usuários. Todas as ações aqui são admin-only
 * (requireAdminAction, independente de qualquer checagem de UI — camada 3
 * da proteção da Etapa 3). "usuarios.escrever" na matriz é sempre
 * ["ADMIN"], então requireAdminAction() é equivalente e mais direto aqui.
 */

const PERFIS_VALIDOS: readonly Perfil[] = ["ADMIN", "TECNICO"];

function ehPerfilValido(valor: string): valor is Perfil {
  return (PERFIS_VALIDOS as readonly string[]).includes(valor);
}

function revalidarTudo() {
  revalidatePath("/usuarios");
}

export type SalvarUsuarioResultado = { ok: true } | { ok: false; erro: string };
export type AcaoUsuarioResultado = { ok: true } | { ok: false; erro: string };

const MSG_ULTIMO_ADMIN = "O sistema deve possuir pelo menos um administrador ativo.";

/**
 * Proteção do último ADMIN ativo (revisão pós-auditoria).
 *
 * A versão anterior desta proteção só bloqueava um ADMIN alterando a SI
 * MESMO (autoproteção). Isso não é suficiente: a regra pedida pela
 * especificação é sobre o estado resultante do sistema como um todo, não
 * sobre quem executa a ação — por isso esta função consulta o banco a cada
 * chamada e conta quantos ADMIN ativos existiriam depois da operação,
 * independentemente de quem está logado ou de qual usuário é o alvo.
 *
 * Retorna `true` quando a operação (excluir, desativar ou trocar o perfil
 * para TECNICO) deixaria o sistema com zero ADMIN ativos — e portanto deve
 * ser bloqueada. Se o alvo não é um ADMIN ativo, a operação não reduz a
 * contagem de admins ativos e não há nada a proteger.
 */
async function operacaoDeixariaSemAdminAtivo(alvoId: number): Promise<boolean> {
  const alvo = await prisma.usuario.findUnique({
    where: { id: alvoId },
    select: { perfil: true, ativo: true },
  });
  if (!alvo || alvo.perfil !== "ADMIN" || !alvo.ativo) return false;

  const totalAdminsAtivos = await prisma.usuario.count({ where: { perfil: "ADMIN", ativo: true } });
  return totalAdminsAtivos <= 1;
}

export async function createUsuario(formData: FormData): Promise<SalvarUsuarioResultado> {
  await requireAdminAction();

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const perfilRaw = String(formData.get("perfil") || "");

  if (!nome) return { ok: false, erro: "Informe o nome." };
  if (!email) return { ok: false, erro: "Informe o e-mail." };
  if (!ehPerfilValido(perfilRaw)) return { ok: false, erro: "Selecione um perfil válido." };
  if (!senhaAtendeRequisitosMinimos(senha)) {
    return { ok: false, erro: "A senha deve ter pelo menos 8 caracteres." };
  }

  try {
    await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash: hashSenha(senha),
        perfil: perfilRaw,
        ativo: true,
      },
    });
  } catch (e) {
    // P2002 = violação de unicidade em email.
    console.error("Erro ao criar usuário (possível e-mail duplicado):", e);
    return { ok: false, erro: "Já existe um usuário cadastrado com este e-mail." };
  }

  revalidarTudo();
  redirect("/usuarios");
}

/**
 * Edita nome/e-mail/perfil e, opcionalmente, a senha (campo em branco =
 * mantém a senha atual). A UI (UsuarioForm + bloquearTrocaPerfil) já
 * desabilita a troca de perfil quando um ADMIN edita a própria conta, mas
 * essa é só a camada 1 — a proteção real (camada 3) é a checagem abaixo,
 * que vale para qualquer chamada, inclusive uma requisição manual direta
 * a esta Server Action.
 */
export async function updateUsuario(formData: FormData): Promise<SalvarUsuarioResultado> {
  await requireAdminAction();

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, erro: "Usuário inválido." };

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const perfilRaw = String(formData.get("perfil") || "");

  if (!nome) return { ok: false, erro: "Informe o nome." };
  if (!email) return { ok: false, erro: "Informe o e-mail." };
  if (!ehPerfilValido(perfilRaw)) return { ok: false, erro: "Selecione um perfil válido." };
  if (senha && !senhaAtendeRequisitosMinimos(senha)) {
    return { ok: false, erro: "A senha deve ter pelo menos 8 caracteres." };
  }

  if (perfilRaw !== "ADMIN" && (await operacaoDeixariaSemAdminAtivo(id))) {
    return { ok: false, erro: MSG_ULTIMO_ADMIN };
  }

  try {
    await prisma.usuario.update({
      where: { id },
      data: {
        nome,
        email,
        perfil: perfilRaw,
        ...(senha ? { senhaHash: hashSenha(senha) } : {}),
      },
    });
  } catch (e) {
    console.error("Erro ao atualizar usuário (possível e-mail duplicado):", e);
    return { ok: false, erro: "Já existe um usuário cadastrado com este e-mail." };
  }

  revalidarTudo();
  revalidatePath(`/usuarios/${id}`);
  redirect("/usuarios");
}

/**
 * Alterna ativo/inativo. Um usuário inativo perde o acesso imediatamente na
 * próxima requisição (getUsuarioAtual() sempre lê o banco — ver lib/auth.ts).
 * Bloqueia a operação quando o alvo é o último ADMIN ativo do sistema —
 * consulta o banco a cada chamada, não depende de quem está logado.
 */
export async function toggleUsuarioAtivo(formData: FormData): Promise<AcaoUsuarioResultado> {
  await requireAdminAction();

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, erro: "Usuário inválido." };

  const atual = await prisma.usuario.findUnique({ where: { id }, select: { ativo: true } });
  if (!atual) return { ok: false, erro: "Usuário não encontrado." };

  // Só é uma "desativação" (redução da contagem de admins ativos) quando o
  // usuário está atualmente ativo e está prestes a virar inativo.
  if (atual.ativo && (await operacaoDeixariaSemAdminAtivo(id))) {
    return { ok: false, erro: MSG_ULTIMO_ADMIN };
  }

  await prisma.usuario.update({ where: { id }, data: { ativo: !atual.ativo } });
  revalidarTudo();
  revalidatePath(`/usuarios/${id}`);
  return { ok: true };
}

/** Exclui a conta. Bloqueia quando o alvo é o último ADMIN ativo do sistema. */
export async function deleteUsuario(formData: FormData): Promise<AcaoUsuarioResultado> {
  await requireAdminAction();

  const id = Number(formData.get("id"));
  if (!id) return { ok: false, erro: "Usuário inválido." };

  if (await operacaoDeixariaSemAdminAtivo(id)) {
    return { ok: false, erro: MSG_ULTIMO_ADMIN };
  }

  await prisma.usuario.delete({ where: { id } });
  revalidarTudo();
  redirect("/usuarios");
}
