-- AlterTable
ALTER TABLE "Ferreteria" ADD COLUMN     "vigenciaHasta" DATE;

-- CreateTable
CREATE TABLE "PagoPlataforma" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(10,2),
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE NOT NULL,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoPlataforma_ferreteriaId_idx" ON "PagoPlataforma"("ferreteriaId");

-- AddForeignKey
ALTER TABLE "PagoPlataforma" ADD CONSTRAINT "PagoPlataforma_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoPlataforma" ADD CONSTRAINT "PagoPlataforma_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
