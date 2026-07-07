import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma singleton.
 * Evita esgotar conexões com o PostgreSQL durante hot-reload em desenvolvimento
 * (cada reload recarregaria o módulo e criaria um novo PrismaClient sem isso).
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export default prisma;
