/*
  Correção pós-V6: a migration "20260707000000_colaborador_mestre" reestruturou
  "colaboradores" mas esqueceu de adicionar a coluna "regional" (presente no
  schema.prisma, usada em app/home/page.tsx e no Cadastro Mestre). Isso causava
  o erro em runtime: "The column colaboradores.regional does not exist in the
  current database." Esta migration apenas adiciona a coluna faltante.
*/

ALTER TABLE "colaboradores" ADD COLUMN "regional" TEXT;
