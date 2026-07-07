/*
  V6 — REESTRUTURAÇÃO CORPORATIVA: Cadastro Mestre de Colaboradores.

  Remove os models Leader e Equipe. Colaborador passa a ser a única entidade
  central de pessoas (Master Data), sem CPF/RG, identificada por `cadastro`
  (matrícula). SupportTicket passa a apontar para um único colaborador.

  Antes de derrubar as tabelas "leaders"/"equipes", este script copia o nome
  do líder/equipe de cada atendimento existente para colunas de texto
  soltas (liderNomeHistorico/equipeNomeHistorico) em support_tickets, para
  que o histórico de atendimentos antigos continue legível mesmo sem as
  tabelas de origem. O Cadastro Mestre de Colaboradores em si começa vazio
  (decisão do usuário) — nenhum líder/colaborador antigo é migrado para a
  nova tabela "colaboradores".

  Warnings:
  - As tabelas "leaders" e "equipes" serão apagadas permanentemente.
  - As colunas "funcao", "equipeId", "email", "rg", "cpf", "dataAdmissao" de
    "colaboradores" serão apagadas permanentemente (dados de colaboradores
    cadastrados antes da V6 são perdidos; o Cadastro Mestre é repopulado via
    Importação Massiva / Smart Sync).
  - As colunas "liderId"/"equipeId" de "support_tickets" serão apagadas
    (o nome fica preservado em texto nas novas colunas *_NomeHistorico).
*/

-- 1) Preparar novas colunas em support_tickets ANTES de apagar leaders/equipes,
--    para conseguir copiar os nomes para o histórico.
ALTER TABLE "support_tickets" ADD COLUMN     "colaboradorId" INTEGER,
ADD COLUMN     "liderNomeHistorico" TEXT,
ADD COLUMN     "equipeNomeHistorico" TEXT;

-- 2) Backfill do snapshot histórico a partir das tabelas antigas.
UPDATE "support_tickets" t
SET "liderNomeHistorico" = l."nome"
FROM "leaders" l
WHERE t."liderId" = l."id";

UPDATE "support_tickets" t
SET "equipeNomeHistorico" = e."nome"
FROM "equipes" e
WHERE t."equipeId" = e."id";

-- 3) Derrubar as foreign keys e índices antigos.
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_liderId_fkey";
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_equipeId_fkey";
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_equipeId_fkey";
ALTER TABLE "equipes" DROP CONSTRAINT "equipes_leaderId_fkey";

DROP INDEX "support_tickets_liderId_idx";
DROP INDEX "support_tickets_equipeId_idx";

-- 4) Remover as colunas antigas de support_tickets e apagar leaders/equipes.
ALTER TABLE "support_tickets" DROP COLUMN "liderId",
DROP COLUMN "equipeId";

DROP TABLE "equipes";
DROP TABLE "leaders";

-- 5) Reestruturar colaboradores para o novo Cadastro Mestre.
ALTER TABLE "colaboradores" DROP COLUMN "funcao",
DROP COLUMN "equipeId",
DROP COLUMN "email",
DROP COLUMN "rg",
DROP COLUMN "cpf",
DROP COLUMN "dataAdmissao",
ADD COLUMN     "tipoPessoa" TEXT,
ADD COLUMN     "cadastro" TEXT,
ADD COLUMN     "empresaNome" TEXT,
ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "dataImportacao" TIMESTAMP(3),
ADD COLUMN     "ultimaAtualizacao" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "colaboradores" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "colaboradores" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX "colaboradores_cadastro_key" ON "colaboradores"("cadastro");

-- 6) Ligar support_tickets ao novo Cadastro Mestre.
CREATE INDEX "support_tickets_colaboradorId_idx" ON "support_tickets"("colaboradorId");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
