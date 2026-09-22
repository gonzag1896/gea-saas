-- Escrita a mano: `prisma migrate dev` no puede correr sin interacción
-- cuando hay pérdida de datos potencial (columnas nuevas NOT NULL sobre
-- filas existentes) — acá se resuelve con backfill explícito en vez de
-- pedir confirmación.

-- AlterEnum: nuevo medio de pago "Débito" (tarjeta de débito).
ALTER TYPE "MedioPago" ADD VALUE 'DEBITO';

-- AlterEnum: una venta/compra Contado o Débito ahora también se asienta
-- en la cuenta corriente (Debe + Haber por el mismo monto, saldo neto
-- sin cambios) para que el historial del cliente/proveedor quede
-- completo, no solo lo que debe.
ALTER TYPE "OrigenCuentaCliente" ADD VALUE 'VENTA_CONTADO';
ALTER TYPE "OrigenCuentaProveedor" ADD VALUE 'COMPRA_CONTADO';

-- AlterTable: IVA pasa de la cabecera de Venta a cada línea (mismo
-- criterio que ya usaba CompraDetalle.tipoIva). Se pierden los 4 valores
-- ya cargados en Venta.tipoIva -- aceptable, todavía no hay datos reales
-- de cliente en producción.
ALTER TABLE "VentaDetalle" ADD COLUMN     "tipoIva" "TipoIva" NOT NULL DEFAULT 'EXENTO';
ALTER TABLE "Venta" DROP COLUMN "tipoIva";

-- AlterTable: CierreCaja pasa a soportar un rango de fechas (fecha =
-- inicio, fechaHasta = fin inclusive; iguales para un cierre de un solo
-- día) y un monto inicial de caja (fondo). Backfill: fechaHasta = fecha
-- y updatedAt = createdAt para las filas que ya existían.
ALTER TABLE "CierreCaja" ADD COLUMN     "fechaHasta" DATE;
UPDATE "CierreCaja" SET "fechaHasta" = "fecha" WHERE "fechaHasta" IS NULL;
ALTER TABLE "CierreCaja" ALTER COLUMN "fechaHasta" SET NOT NULL;

ALTER TABLE "CierreCaja" ADD COLUMN     "montoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" ADD COLUMN     "actualizadoPorUsuarioId" TEXT;
ALTER TABLE "CierreCaja" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "CierreCaja" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "CierreCaja" ALTER COLUMN "updatedAt" SET NOT NULL;

-- DropIndex: el UNIQUE de (ferreteriaId, fecha) no tiene sentido con
-- cierres por rango -- dos períodos válidos pueden compartir fecha de
-- inicio sin ser el mismo día. Que ningún día quede cubierto dos veces
-- se valida a mano en registrarCierreCaja antes de insertar.
DROP INDEX "CierreCaja_ferreteriaId_fecha_key";

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_actualizadoPorUsuarioId_fkey" FOREIGN KEY ("actualizadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
