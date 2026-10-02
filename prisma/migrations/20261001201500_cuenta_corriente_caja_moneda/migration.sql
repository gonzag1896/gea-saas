-- Cuenta Corriente (clientes y proveedores) y Caja en dos monedas.
--
-- CuentaCliente/CuentaProveedor ganan "moneda" — el histórico es 100%
-- pesos de verdad (mismo motivo que la migración anterior), el default
-- 'UYU' ya cubre el backfill sin necesitar un UPDATE aparte.
ALTER TABLE "CuentaCliente" ADD COLUMN "moneda" "Moneda" NOT NULL DEFAULT 'UYU';
ALTER TABLE "CuentaProveedor" ADD COLUMN "moneda" "Moneda" NOT NULL DEFAULT 'UYU';

-- CierreCaja: no hay filas existentes en ningún ambiente todavía (recién
-- se armó esta fase, antes de que alguien llegara a cerrar caja con el
-- esquema viejo) — se puede reemplazar directo, sin backfill.
ALTER TABLE "CierreCaja" RENAME COLUMN "montoInicial" TO "montoInicialUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "montoInicialUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" RENAME COLUMN "totalVentasContado" TO "totalVentasContadoUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "totalVentasContadoUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" RENAME COLUMN "totalCobrosContado" TO "totalCobrosContadoUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "totalCobrosContadoUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" RENAME COLUMN "totalEsperado" TO "totalEsperadoUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "totalEsperadoUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" RENAME COLUMN "totalContado" TO "totalContadoUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "totalContadoUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CierreCaja" RENAME COLUMN "diferencia" TO "diferenciaUYU";
ALTER TABLE "CierreCaja" ADD COLUMN "diferenciaUSD" DECIMAL(12,2) NOT NULL DEFAULT 0;
