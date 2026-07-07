-- CreateTable
CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "numero" SERIAL NOT NULL,
    "dataAtendimento" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT,
    "tempoAtendimento" INTEGER,
    "liderId" INTEGER,
    "equipeId" INTEGER,
    "projeto" TEXT,
    "cliente" TEXT,
    "tipoAtendimento" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricaoProblema" TEXT NOT NULL,
    "solucaoAplicada" TEXT,
    "resultado" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Aberto',
    "observacoes" TEXT,
    "tecnicoResponsavel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_numero_key" ON "support_tickets"("numero");

-- CreateIndex
CREATE INDEX "support_tickets_liderId_idx" ON "support_tickets"("liderId");

-- CreateIndex
CREATE INDEX "support_tickets_equipeId_idx" ON "support_tickets"("equipeId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_categoria_idx" ON "support_tickets"("categoria");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "leaders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
