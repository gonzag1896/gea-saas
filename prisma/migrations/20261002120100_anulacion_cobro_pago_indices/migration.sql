-- Un cobro/pago solo se puede anular una vez: a lo sumo un contraasiento
-- por movimiento original.
CREATE UNIQUE INDEX "CuentaCliente_anulacion_cobro_key" ON "CuentaCliente"("origenId") WHERE "origenTipo" = 'ANULACION_COBRO';
CREATE UNIQUE INDEX "CuentaProveedor_anulacion_pago_key" ON "CuentaProveedor"("origenId") WHERE "origenTipo" = 'ANULACION_PAGO';
