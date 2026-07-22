-- MISSÃO: Categoria hierárquica no módulo de Suporte Técnico.
--
-- Adiciona 3 colunas opcionais (nullable) ao SupportTicket para permitir a
-- classificação em até 3 níveis (Categoria Principal → Subcategoria →
-- Detalhamento), conforme a estrutura oficial definida em
-- lib/categoriasSuporte.ts.
--
-- Migration puramente aditiva:
--   - Sem DROP COLUMN.
--   - Sem RENAME (destrutivo ou não).
--   - Sem valor DEFAULT obrigatório / NOT NULL.
--   - Sem TRUNCATE, sem recriação de tabela, sem reset de banco.
--
-- O campo legado `categoria` (já existente, obrigatório) NÃO é tocado por
-- esta migration — continua exatamente como estava, preservando 100% dos
-- atendimentos já registrados. Atendimentos antigos ficam com as 3 colunas
-- novas em NULL e continuam aparecendo normalmente na interface, exibidos
-- como "categoria legada" a partir do valor de `categoria`.
--
-- Escrita manualmente (sem conexão com o banco real neste ambiente) seguindo
-- a mesma convenção já usada nas migrations anteriores deste projeto
-- (20260721000000_add_usuario, 20260722140000_add_site_suporte). Deve ser
-- aplicada com `npx prisma migrate deploy` a partir de uma máquina com
-- acesso à DATABASE_URL real — nenhum comando foi executado contra o banco
-- de produção a partir desta sessão.

ALTER TABLE "support_tickets"
ADD COLUMN "categoriaPrincipal" TEXT,
ADD COLUMN "subcategoria" TEXT,
ADD COLUMN "detalhamento" TEXT;
