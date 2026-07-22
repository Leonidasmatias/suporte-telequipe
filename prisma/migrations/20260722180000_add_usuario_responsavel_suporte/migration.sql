-- MISSÃO: Controle de visualização e exportação por perfil.
--
-- Problema encontrado (documentado no relatório final da missão): a tabela
-- "support_tickets" não tinha nenhum vínculo confiável com a conta de login
-- (Usuario) responsável pelo atendimento. O único campo relacionado,
-- "tecnicoResponsavel", é texto livre digitado no formulário — não é FK,
-- pode repetir entre pessoas diferentes, ter erro de digitação, ou não
-- corresponder a nenhuma conta de login. Não é seguro usar esse campo para
-- controlar quem pode ver/editar/exportar cada atendimento.
--
-- Solução (decisão explícita do usuário do sistema, opção "só ADMIN vê os
-- antigos"): adiciona uma coluna nova e opcional, "usuarioResponsavelId",
-- como FK para "usuarios"(id). A partir de agora, toda Server Action de
-- criação de atendimento preenche esta coluna automaticamente a partir da
-- sessão autenticada (nunca a partir de um campo de formulário). Atendimentos
-- já existentes ficam com esta coluna em NULL — não há, e propositalmente
-- não foi feita, nenhuma tentativa de vincular retroativamente pelo nome de
-- "tecnicoResponsavel" (risco de vincular ao técnico errado, já que nomes
-- podem repetir ou ter variações). Atendimentos com NULL aqui só ficam
-- visíveis para ADMIN.
--
-- Migration puramente aditiva:
--   - Sem DROP COLUMN, sem RENAME, sem valor DEFAULT obrigatório/NOT NULL.
--   - Sem TRUNCATE, sem recriação de tabela, sem reset de banco.
--   - Nenhuma linha existente de "support_tickets" é alterada por este
--     arquivo — todas continuam exatamente como estão, só ganham uma coluna
--     nova em NULL.
--
-- Escrita manualmente (sem conexão com o banco real neste ambiente), seguindo
-- a mesma convenção das migrations anteriores deste projeto. Deve ser
-- aplicada com `npx prisma migrate deploy` a partir de uma máquina com acesso
-- à DATABASE_URL real — nenhum comando foi executado contra o banco de
-- produção a partir desta sessão.

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "usuarioResponsavelId" INTEGER;

-- CreateIndex
CREATE INDEX "support_tickets_usuarioResponsavelId_idx" ON "support_tickets"("usuarioResponsavelId");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_usuarioResponsavelId_fkey" FOREIGN KEY ("usuarioResponsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
