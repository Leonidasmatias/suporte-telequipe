/*
  V6.1 — Ajuste pós-análise da planilha real "BASE_COLABORADORES_INICIAL_2026".

  A coluna "Cadastro" do arquivo oficial não é uma matrícula/ID único: na
  prática contém as operadoras/clientes atendidos pelo colaborador (ex.:
  "ERICSSON/NOKIA"), se repete entre pessoas diferentes e frequentemente vem
  vazia. Por isso:

  1) A coluna "cadastro" é renomeada para "operadoras" e perde a constraint
     de unicidade (não é mais usada como chave de deduplicação).
  2) Uma nova coluna "nomeNormalizado" passa a ser a chave natural do Smart
     Sync — nome em maiúsculas, sem acento, com espaços colapsados —, única
     e derivada automaticamente de "nome".

  CORREÇÃO (2ª tentativa): a 1ª tentativa desta migration falhou (P3018) —
  o banco já tinha colaboradores de teste com nome duplicado ("DIOGENES
  ALVES BRITO"), então a UPDATE simples gerava valores repetidos de
  "nomeNormalizado" e a criação do índice único quebrava. Como a migration
  inteira roda em uma transação, nada chegou a ser aplicado (a coluna
  "operadoras" e o rename foram desfeitos automaticamente). O backfill
  abaixo agora desambigua duplicatas automaticamente, sufixando " #2",
  " #3"... nos registros repetidos (mantém o primeiro registro com a chave
  limpa) — isso NÃO apaga nem mistura dados, só evita a quebra do índice
  único; duplicatas reais podem ser revisadas depois na tela /colaboradores.
*/

-- 1) A coluna "cadastro" deixa de ser chave única.
DROP INDEX "colaboradores_cadastro_key";

-- 2) Renomear para refletir o significado real do dado.
ALTER TABLE "colaboradores" RENAME COLUMN "cadastro" TO "operadoras";

-- 3) Nova chave natural de deduplicação.
ALTER TABLE "colaboradores" ADD COLUMN "nomeNormalizado" TEXT;

-- 4) Backfill: normaliza o nome de qualquer colaborador já existente
--    (maiúsculas, sem acento, espaços colapsados e aparados). Quando o
--    mesmo nome normalizado já existir em mais de um registro, os
--    registros extras recebem um sufixo " #2", " #3"... para não violar a
--    unicidade — o registro mais antigo (menor id) fica com a chave limpa.
WITH normalizados AS (
  SELECT
    "id",
    UPPER(
      TRIM(
        REGEXP_REPLACE(
          TRANSLATE(
            "nome",
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
          ),
          '\s+', ' ', 'g'
        )
      )
    ) AS chave,
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(
        TRIM(
          REGEXP_REPLACE(
            TRANSLATE(
              "nome",
              'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
            ),
            '\s+', ' ', 'g'
          )
        )
      )
      ORDER BY "id"
    ) AS rn
  FROM "colaboradores"
)
UPDATE "colaboradores" c
SET "nomeNormalizado" = CASE WHEN n.rn = 1 THEN n.chave ELSE n.chave || ' #' || n.rn END
FROM normalizados n
WHERE c."id" = n."id";

-- 5) Torna "nomeNormalizado" único.
CREATE UNIQUE INDEX "colaboradores_nomeNormalizado_key" ON "colaboradores"("nomeNormalizado");
