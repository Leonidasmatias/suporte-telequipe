import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Autenticação por usuário (Etapa 1). Substitui o antigo "modo de edição"
 * por senha única compartilhada para todo mundo (ver commit "Controle de
 * acesso: modo de edicao com senha, visualizacao livre") por contas
 * individuais com e-mail/senha e perfil — model Usuario em schema.prisma.
 *
 * O cookie de sessão guarda APENAS o id do usuário + expiração, assinado
 * (HMAC-SHA256 + AUTH_SECRET) — nunca o perfil nem o status "ativo". Isso é
 * proposital: perfil/ativo são sempre relidos do banco a cada verificação
 * (getUsuarioAtual), então rebaixar ou inativar um usuário tem efeito já na
 * próxima requisição, sem depender do cookie ser trocado ou expirar.
 *
 * As decisões de "quem pode ver/fazer o quê" (a matriz ADMIN x TECNICO)
 * ficam em lib/autorizacao.ts — este arquivo só resolve "quem está logado".
 */

const COOKIE_SESSAO = "sessao_usuario";
export { COOKIE_SESSAO };

// Sessão de 12h: equilíbrio entre não pedir login o dia inteiro inteiro e não
// manter uma sessão órfã por semanas depois que alguém é desligado/rebaixado
// (já mitigado por getUsuarioAtual reler o banco, mas expiração curta é
// defesa em profundidade).
const SESSAO_DURACAO_MS = 1000 * 60 * 60 * 12;
export const SESSAO_MAX_AGE_SEGUNDOS = Math.floor(SESSAO_DURACAO_MS / 1000);

export type Perfil = "ADMIN" | "TECNICO";

export type UsuarioSessao = {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
};

function getSegredo(): string {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) {
    throw new Error(
      "AUTH_SECRET não configurado no ambiente. Defina uma string aleatória nas variáveis de ambiente."
    );
  }
  return segredo;
}

function assinar(payload: string): string {
  return crypto.createHmac("sha256", getSegredo()).update(payload).digest("hex");
}

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Gera "usuarioId.expiraEm.assinatura" — prova de que o login foi validado, sem carregar perfil/status. */
export function criarTokenSessao(usuarioId: number): string {
  const expiraEm = Date.now() + SESSAO_DURACAO_MS;
  const payload = `${usuarioId}.${expiraEm}`;
  return `${payload}.${assinar(payload)}`;
}

function usuarioIdDoToken(token: string): number | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [idRaw, expiraRaw, assinatura] = partes;
  const payload = `${idRaw}.${expiraRaw}`;
  if (!compararSeguro(assinar(payload), assinatura)) return null;

  const expiraEm = Number(expiraRaw);
  if (!Number.isFinite(expiraEm) || Date.now() >= expiraEm) return null;

  const usuarioId = Number(idRaw);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;

  return usuarioId;
}

/**
 * Fonte única de verdade sobre "quem está logado agora". SEMPRE relê o
 * usuário do banco (nunca confia em perfil/ativo vindos só do cookie) — por
 * isso é assíncrona. Retorna null se: sem cookie, assinatura inválida,
 * expirado, usuário não existe mais, ou usuário inativo.
 *
 * Use esta função (ou os helpers em lib/autorizacao.ts) em toda página,
 * Server Action e rota de API que precise saber o usuário atual — nunca leia
 * o cookie diretamente em outro lugar do código.
 */
export async function getUsuarioAtual(): Promise<UsuarioSessao | null> {
  const token = cookies().get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  let usuarioId: number | null;
  try {
    usuarioId = usuarioIdDoToken(token);
  } catch {
    return null;
  }
  if (usuarioId === null) return null;

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.ativo) return null;

  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil as Perfil };
}
