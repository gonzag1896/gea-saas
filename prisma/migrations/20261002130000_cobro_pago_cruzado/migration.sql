-- Cobros/pagos cruzados: se paga una deuda en una moneda con la otra.
ALTER TABLE "CuentaCliente"
  ADD COLUMN "montoRecibido" DECIMAL(12,2),
  ADD COLUMN "monedaRecibida" "Moneda",
  ADD COLUMN "cotizacion" DECIMAL(10,4);

ALTER TABLE "CuentaProveedor"
  ADD COLUMN "montoRecibido" DECIMAL(12,2),
  ADD COLUMN "monedaRecibida" "Moneda",
  ADD COLUMN "cotizacion" DECIMAL(10,4);
