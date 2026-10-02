-- Pesos y dólares por separado en Ventas y Compras.
--
-- VentaDetalle/CompraDetalle ganan "moneda" y "cotizacion" (solo
-- referencia, nunca se usa para calcular). Venta/Compra reemplazan
-- subtotal/iva/total (un solo número en pesos, que venía de convertir las
-- líneas en dólares con la cotización del momento) por pares UYU/USD.
--
-- Backfill de lo existente: como hasta ahora TODO se convertía a pesos
-- antes de guardar, el histórico es 100% pesos de verdad — se copia tal
-- cual a la columna *UYU y la *USD queda en 0. Las líneas existentes
-- quedan con moneda='UYU' (el default ya cubre eso).

-- AlterTable: VentaDetalle
ALTER TABLE "VentaDetalle" ADD COLUMN "moneda" "Moneda" NOT NULL DEFAULT 'UYU';
ALTER TABLE "VentaDetalle" ADD COLUMN "cotizacion" DECIMAL(10,4);

-- AlterTable: CompraDetalle
ALTER TABLE "CompraDetalle" ADD COLUMN "moneda" "Moneda" NOT NULL DEFAULT 'UYU';
ALTER TABLE "CompraDetalle" ADD COLUMN "cotizacion" DECIMAL(10,4);

-- AlterTable: Venta — nuevas columnas, backfill desde las viejas, drop de las viejas.
ALTER TABLE "Venta" ADD COLUMN "subtotalUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venta" ADD COLUMN "subtotalUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venta" ADD COLUMN "ivaUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venta" ADD COLUMN "ivaUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venta" ADD COLUMN "totalUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Venta" ADD COLUMN "totalUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Venta" SET "subtotalUYU" = "subtotal", "ivaUYU" = "iva", "totalUYU" = "total";

ALTER TABLE "Venta" DROP COLUMN "subtotal";
ALTER TABLE "Venta" DROP COLUMN "iva";
ALTER TABLE "Venta" DROP COLUMN "total";

-- AlterTable: Compra — mismo patrón.
ALTER TABLE "Compra" ADD COLUMN "subtotalUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Compra" ADD COLUMN "subtotalUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Compra" ADD COLUMN "ivaUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Compra" ADD COLUMN "ivaUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Compra" ADD COLUMN "totalUYU" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Compra" ADD COLUMN "totalUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Compra" SET "subtotalUYU" = "subtotal", "ivaUYU" = "iva", "totalUYU" = "total";

ALTER TABLE "Compra" DROP COLUMN "subtotal";
ALTER TABLE "Compra" DROP COLUMN "iva";
ALTER TABLE "Compra" DROP COLUMN "total";
