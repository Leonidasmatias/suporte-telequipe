/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `equipes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "equipes" ADD COLUMN     "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "equipes_codigo_key" ON "equipes"("codigo");
