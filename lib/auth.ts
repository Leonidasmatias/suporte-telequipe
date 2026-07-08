import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Controle de acesso simples do sistema: visualização é livre para qualquer
 * pessoa com o link, mas ações de escrita (criar, editar, excluir, alternar
 * status, confirmar sincronização etc.) exigem que o "modo de edição" esteja
 * destravado — o que só acontece informando a senha em EDIT_PASSWORD.
 *
 * O desbloqueio é guardado em um cookie httpOnly assinado com AUTH_SECRET
 * (HMAC-SHA256 + expiração), então não pode ser forjado sem conhecer o
 * segredo do servidor.
 */

const COOKIE_EDICAO = "edicao_sessao";
const SESSAO_DURACAO_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
export const SESSAO_MAX_AGE_SEGUNDOS = Math.floor(SESSAO_DURACAO_MS / 1000);
export { COOKIE_EDICAO };

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

/** Gera um token assinado "expiraEm.assinatura" que prova que a senha de edição foi validada. */
export function criarTokenSessao(): string {
  const expiraEm = Date.now() + SESSAO_DURACAO_MS;
  const payload = String(expiraEm);
  return `${payload}.${assinar(payload)}`;
}

function tokenValido(token: string): boolean {
  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) return false;
  if (!compararSeguro(assinar(payload), assinatura)) return false;
  const expiraEm = Number(payload);
  return Number.isFinite(expiraEm) && Date.now() < expiraEm;
}

/** Compara a senha informada com EDIT_PASSWORD em tempo constante. */
export function senhaCorreta(senha: string): boolean {
  const esperada = process.env.EDIT_PASSWORD;
  if (!esperada || !senha) return false;
  return compararSeguro(senha, esperada);
}

/** Lê o cookie de sessão (uso em Server Components/Actions) e diz se o modo de edição está liberado. */
export function estaEmModoEdicao(): boolean {
  const token = cookies().get(COOKIE_EDICAO)?.value;
  if (!token) return false;
  try {
    return tokenValido(token);
  } catch {
    return false;
  }
}

/**
 * Chame no início de toda Server Action que escreve no banco. Lança erro se
 * o modo de edição não estiver ativo — barreira de segurança independente
 * da UI (que já esconde os controles de edição nesse caso).
 */
export function garantirModoEdicao(): void {
  if (!estaEmModoEdicao()) {
    throw new Error(
      "Ação bloqueada: o modo de edição não está ativo nesta sessão. Destrave a edição na barra lateral com a senha para continuar."
    );
  }
}
