-- CreateEnum
CREATE TYPE "OrigenCuentaProveedor" AS ENUM ('COMPRA_CREDITO', 'PAGO', 'DEVOLUCION_COMPRA', 'ANULACION_COMPRA_CREDITO');

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "medioPago" "MedioPago" NOT NULL DEFAULT 'CONTADO';

-- CreateTable
CREATE TABLE "CuentaProveedor" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "debe" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "origenTipo" "OrigenCuentaProveedor" NOT NULL,
    "origenId" TEXT,
    "referencia" TEXT,
    "medioPago" "MedioPago",
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaProveedor_ferreteriaId_proveedorId_fecha_idx" ON "CuentaProveedor"("ferreteriaId", "proveedorId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaProveedor_id_ferreteriaId_key" ON "CuentaProveedor"("id", "ferreteriaId");

-- AddForeignKey
ALTER TABLE "CuentaProveedor" ADD CONSTRAINT "CuentaProveedor_proveedorId_ferreteriaId_fkey" FOREIGN KEY ("proveedorId", "ferreteriaId") REFERENCES "Proveedor"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaProveedor" ADD CONSTRAINT "CuentaProveedor_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Stock negativo permitido: una venta nunca se rechaza por falta de stock
-- (el negocio prefiere registrar la venta y quedar en negativo antes que
-- bloquear el mostrador). Se quita el CHECK que lo impedía.
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_stockActual_check";
