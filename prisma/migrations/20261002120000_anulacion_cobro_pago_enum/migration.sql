-- Anulación de cobros a clientes y pagos a proveedores. Los valores nuevos
-- del enum van en su propia migración: Postgres no deja usar un valor
-- recién agregado dentro de la misma transacción (el índice parcial de la
-- migración siguiente lo referencia).
ALTER TYPE "OrigenCuentaCliente" ADD VALUE 'ANULACION_COBRO';
ALTER TYPE "OrigenCuentaProveedor" ADD VALUE 'ANULACION_PAGO';
