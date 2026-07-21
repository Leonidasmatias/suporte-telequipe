-- V7 — Etapa 1/2/3 (Autenticação, Gestão de Usuários, Permissões)
--
-- Escrita manualmente, seguindo a mesma convenção já usada nas migrations
-- anteriores deste projeto (ex.: 20260706120000_init, 20260707000000_colaborador_mestre):
-- não há conexão com um banco real disponível no ambiente onde esta migration
-- foi preparada. Rode `npx prisma migrate deploy` a partir de uma máquina com
-- acesso a DATABASE_URL para aplicá-la — o Prisma detecta que o schema já
-- bate com o SQL abaixo e apenas registra a migration como aplicada.
--
-- Cria o enum PerfilUsuario e a tabela "usuarios" (model Usuario). Não altera
-- nenhuma tabela existente — é uma adição pura, sem risco de perda de dados.

CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'TECNICO');

CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
