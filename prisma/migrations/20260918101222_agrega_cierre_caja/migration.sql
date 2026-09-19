-- AlterTable
ALTER TABLE "CuentaCliente" ADD COLUMN     "medioPago" "MedioPago";

-- CreateTable
CREATE TABLE "CierreCaja" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "totalVentasContado" DECIMAL(12,2) NOT NULL,
    "totalCobrosContado" DECIMAL(12,2) NOT NULL,
    "totalEsperado" DECIMAL(12,2) NOT NULL,
    "totalContado" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CierreCaja_ferreteriaId_fecha_idx" ON "CierreCaja"("ferreteriaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CierreCaja_ferreteriaId_fecha_key" ON "CierreCaja"("ferreteriaId", "fecha");

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

