import crypto from "crypto";

/**
 * Hash de senha com scrypt (nativo do Node — sem dependência nova). Formato
 * armazenado: "saltHex:hashHex". scrypt já é lento/memory-hard por design
 * (proteção contra força bruta), então não precisamos de rounds/custo
 * configurável separado como em bcrypt.
 */

const TAMANHO_SALT_BYTES = 16;
const TAMANHO_HASH_BYTES = 64;

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(TAMANHO_SALT_BYTES).toString("hex");
  const hash = crypto.scryptSync(senha, salt, TAMANHO_HASH_BYTES).toString("hex");
  return `${salt}:${hash}`;
}

/** Compara em tempo constante — nunca usar `===` direto em segredos. */
export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salt, hashEsperadoHex] = hashArmazenado.split(":");
  if (!salt || !hashEsperadoHex) return false;

  const hashCalculado = crypto.scryptSync(senha, salt, TAMANHO_HASH_BYTES);
  const hashEsperado = Buffer.from(hashEsperadoHex, "hex");
  if (hashCalculado.length !== hashEsperado.length) return false;

  return crypto.timingSafeEqual(hashCalculado, hashEsperado);
}

/** Regra mínima de senha para contas criadas/editadas via /usuarios. */
export function senhaAtendeRequisitosMinimos(senha: string): boolean {
  return typeof senha === "string" && senha.length >= 8;
}
