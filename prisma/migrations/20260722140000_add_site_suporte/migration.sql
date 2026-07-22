-- Adiciona o campo opcional "site" aos atendimentos do módulo de Suporte
-- Técnico (registra o site que estava sendo atendido, ex.: "SN-AQDIK4").
--
-- Escrita manualmente, seguindo a mesma convenção já usada nas migrations
-- anteriores deste projeto (ex.: 20260721000000_add_usuario): não há conexão
-- com um banco real disponível no ambiente onde esta migration foi
-- preparada. Rode `npx prisma migrate deploy` a partir de uma máquina com
-- acesso a DATABASE_URL para aplicá-la.
--
-- Adição pura (ALTER TABLE ... ADD COLUMN, nullable, sem DEFAULT
-- obrigatório) — não apaga, não recria e não altera nenhum dado existente.
-- Atendimentos já registrados ficam com "site" = NULL (preservados
-- integralmente), exatamente como pedido: opcional para não perder nem
-- alterar histórico, e para permitir atendimentos administrativos sem site.

ALTER TABLE "support_tickets" ADD COLUMN "site" TEXT;
