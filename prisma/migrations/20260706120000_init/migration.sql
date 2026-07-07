-- CreateTable
CREATE TABLE "leaders" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "regional" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "regional" TEXT,
    "leaderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "equipeId" INTEGER,
    "telefone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "dataAdmissao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencias_nokia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencias_nokia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_competencia" (
    "id" SERIAL NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "competenciaId" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'Não certificado',
    "avaliadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamentos" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "cargaHoraria" INTEGER,
    "data" TIMESTAMP(3),
    "instrutor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_colaboradores" (
    "id" SERIAL NOT NULL,
    "treinamentoId" INTEGER NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',

    CONSTRAINT "treinamento_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competencias_nokia_nome_key" ON "competencias_nokia"("nome");

-- CreateIndex
CREATE INDEX "avaliacoes_competencia_colaboradorId_competenciaId_idx" ON "avaliacoes_competencia"("colaboradorId", "competenciaId");

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "leaders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_competencia" ADD CONSTRAINT "avaliacoes_competencia_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_competencia" ADD CONSTRAINT "avaliacoes_competencia_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "competencias_nokia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_colaboradores" ADD CONSTRAINT "treinamento_colaboradores_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "treinamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_colaboradores" ADD CONSTRAINT "treinamento_colaboradores_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
