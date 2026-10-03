-- Corrige los saldos afectados por el bug de IVA: antes de d540d2c, devolver
-- artículos o anular una venta/compra a crédito acreditaba solo el neto, sin
-- el 22% de IVA. Equivale a scripts/ajustar-iva-no-acreditado.cjs.
--
-- Cómo usarlo en el SQL Editor de Neon (rama de producción):
--   1) Seleccioná SOLO el PASO 1 y ejecutalo. Es un SELECT: no escribe nada.
--      Revisá la lista (ferretería, cliente/proveedor, monto a acreditar).
--   2) Si coincide con lo esperado, seleccioná SOLO el PASO 2 y ejecutalo.
--      Crea un movimiento de ajuste por venta/compra y moneda, en una sola
--      sentencia (atómica). Es idempotente: si lo ejecutás de nuevo no duplica.
-- Las diferencias negativas (acreditado de más) solo aparecen en el PASO 1 y
-- NO se corrigen automáticamente.

-- ===== PASO 1: SIMULACIÓN (solo lectura) =====
WITH
v AS (
  SELECT ve.id, ve."ferreteriaId", ve."clienteId"
  FROM "Venta" ve
  WHERE ve."medioPago" = 'CREDITO'
    AND (ve.estado = 'ANULADO' OR EXISTS (SELECT 1 FROM "VentaDetalle" d WHERE d."ventaId" = ve.id AND d."cantidadDevuelta" > 0))
    AND EXISTS (SELECT 1 FROM "CuentaCliente" c WHERE c."origenId" = ve.id AND c."origenTipo" = 'VENTA_CREDITO')
),
v_esp AS (
  SELECT d."ventaId" AS doc, d.moneda,
         round((d.total * dv.cantidad / d.cantidad) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END, 2) AS amt
  FROM "VentaDetalle" d JOIN "DevolucionVenta" dv ON dv."ventaDetalleId" = d.id
  UNION ALL
  SELECT x.doc, x.moneda, round(x.suma, 2) FROM (
    SELECT d."ventaId" AS doc, d.moneda, sum(d."totalVigente" * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END) AS suma
    FROM "VentaDetalle" d JOIN "Venta" ve ON ve.id = d."ventaId"
    WHERE ve.estado = 'ANULADO'
    GROUP BY d."ventaId", d.moneda
  ) x
),
v_real AS (
  SELECT va.id AS doc, c.moneda, sum(c.haber) AS amt
  FROM v va
  JOIN "CuentaCliente" c ON c."origenTipo" IN ('DEVOLUCION_VENTA', 'ANULACION_VENTA_CREDITO')
   AND (c."origenId" = va.id OR c."origenId" IN (SELECT dd.id FROM "VentaDetalle" dd WHERE dd."ventaId" = va.id))
  GROUP BY va.id, c.moneda
),
ajv AS (
  SELECT va."ferreteriaId", va."clienteId" AS entidad, va.id AS doc, m.moneda,
         coalesce(e.amt, 0) - coalesce(r.amt, 0) AS dif
  FROM v va
  CROSS JOIN (VALUES ('UYU'::"Moneda"), ('USD'::"Moneda")) m(moneda)
  LEFT JOIN (SELECT doc, moneda, sum(amt) AS amt FROM v_esp GROUP BY doc, moneda) e ON e.doc = va.id AND e.moneda = m.moneda
  LEFT JOIN v_real r ON r.doc = va.id AND r.moneda = m.moneda
),
cpa AS (
  SELECT co.id, co."ferreteriaId", co."proveedorId"
  FROM "Compra" co
  WHERE co."medioPago" = 'CREDITO'
    AND (co.estado = 'ANULADO' OR EXISTS (SELECT 1 FROM "CompraDetalle" d JOIN "DevolucionCompra" dv ON dv."compraDetalleId" = d.id WHERE d."compraId" = co.id))
    AND EXISTS (SELECT 1 FROM "CuentaProveedor" c WHERE c."origenId" = co.id AND c."origenTipo" = 'COMPRA_CREDITO')
),
c_esp AS (
  SELECT d."compraId" AS doc, d.moneda,
         round(dv.cantidad * d."costoUnitario" * (1 - d.descuento / 100) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END, 2) AS amt
  FROM "CompraDetalle" d JOIN "DevolucionCompra" dv ON dv."compraDetalleId" = d.id
  UNION ALL
  SELECT x.doc, x.moneda, round(x.suma, 2) FROM (
    SELECT d."compraId" AS doc, d.moneda,
           sum((d.cantidad - coalesce((SELECT sum(dv.cantidad) FROM "DevolucionCompra" dv WHERE dv."compraDetalleId" = d.id), 0))
               * d."costoUnitario" * (1 - d.descuento / 100) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END) AS suma
    FROM "CompraDetalle" d JOIN "Compra" co ON co.id = d."compraId"
    WHERE co.estado = 'ANULADO'
    GROUP BY d."compraId", d.moneda
  ) x
),
c_real AS (
  SELECT ca.id AS doc, c.moneda, sum(c.haber) AS amt
  FROM cpa ca
  JOIN "CuentaProveedor" c ON c."origenTipo" IN ('DEVOLUCION_COMPRA', 'ANULACION_COMPRA_CREDITO')
   AND (c."origenId" = ca.id OR c."origenId" IN (SELECT dd.id FROM "CompraDetalle" dd WHERE dd."compraId" = ca.id))
  GROUP BY ca.id, c.moneda
),
ajc AS (
  SELECT ca."ferreteriaId", ca."proveedorId" AS entidad, ca.id AS doc, m.moneda,
         coalesce(e.amt, 0) - coalesce(r.amt, 0) AS dif
  FROM cpa ca
  CROSS JOIN (VALUES ('UYU'::"Moneda"), ('USD'::"Moneda")) m(moneda)
  LEFT JOIN (SELECT doc, moneda, sum(amt) AS amt FROM c_esp GROUP BY doc, moneda) e ON e.doc = ca.id AND e.moneda = m.moneda
  LEFT JOIN c_real r ON r.doc = ca.id AND r.moneda = m.moneda
)
SELECT f.nombre AS ferreteria, 'cliente' AS tipo, cl.nombre AS nombre, a.moneda, round(a.dif, 2) AS a_acreditar, a.doc
FROM ajv a JOIN "Ferreteria" f ON f.id = a."ferreteriaId" JOIN "Cliente" cl ON cl.id = a.entidad
WHERE abs(a.dif) >= 0.01
UNION ALL
SELECT f.nombre, 'proveedor', pr.nombre, a.moneda, round(a.dif, 2), a.doc
FROM ajc a JOIN "Ferreteria" f ON f.id = a."ferreteriaId" JOIN "Proveedor" pr ON pr.id = a.entidad
WHERE abs(a.dif) >= 0.01
ORDER BY 1, 2, 3;

-- ===== PASO 2: APLICAR (escribe; ejecutar solo después de revisar el PASO 1) =====
WITH
v AS (
  SELECT ve.id, ve."ferreteriaId", ve."clienteId"
  FROM "Venta" ve
  WHERE ve."medioPago" = 'CREDITO'
    AND (ve.estado = 'ANULADO' OR EXISTS (SELECT 1 FROM "VentaDetalle" d WHERE d."ventaId" = ve.id AND d."cantidadDevuelta" > 0))
    AND EXISTS (SELECT 1 FROM "CuentaCliente" c WHERE c."origenId" = ve.id AND c."origenTipo" = 'VENTA_CREDITO')
),
v_esp AS (
  SELECT d."ventaId" AS doc, d.moneda,
         round((d.total * dv.cantidad / d.cantidad) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END, 2) AS amt
  FROM "VentaDetalle" d JOIN "DevolucionVenta" dv ON dv."ventaDetalleId" = d.id
  UNION ALL
  SELECT x.doc, x.moneda, round(x.suma, 2) FROM (
    SELECT d."ventaId" AS doc, d.moneda, sum(d."totalVigente" * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END) AS suma
    FROM "VentaDetalle" d JOIN "Venta" ve ON ve.id = d."ventaId"
    WHERE ve.estado = 'ANULADO'
    GROUP BY d."ventaId", d.moneda
  ) x
),
v_real AS (
  SELECT va.id AS doc, c.moneda, sum(c.haber) AS amt
  FROM v va
  JOIN "CuentaCliente" c ON c."origenTipo" IN ('DEVOLUCION_VENTA', 'ANULACION_VENTA_CREDITO')
   AND (c."origenId" = va.id OR c."origenId" IN (SELECT dd.id FROM "VentaDetalle" dd WHERE dd."ventaId" = va.id))
  GROUP BY va.id, c.moneda
),
ajv AS (
  SELECT va."ferreteriaId", va."clienteId" AS entidad, va.id AS doc, m.moneda,
         coalesce(e.amt, 0) - coalesce(r.amt, 0) AS dif
  FROM v va
  CROSS JOIN (VALUES ('UYU'::"Moneda"), ('USD'::"Moneda")) m(moneda)
  LEFT JOIN (SELECT doc, moneda, sum(amt) AS amt FROM v_esp GROUP BY doc, moneda) e ON e.doc = va.id AND e.moneda = m.moneda
  LEFT JOIN v_real r ON r.doc = va.id AND r.moneda = m.moneda
),
cpa AS (
  SELECT co.id, co."ferreteriaId", co."proveedorId"
  FROM "Compra" co
  WHERE co."medioPago" = 'CREDITO'
    AND (co.estado = 'ANULADO' OR EXISTS (SELECT 1 FROM "CompraDetalle" d JOIN "DevolucionCompra" dv ON dv."compraDetalleId" = d.id WHERE d."compraId" = co.id))
    AND EXISTS (SELECT 1 FROM "CuentaProveedor" c WHERE c."origenId" = co.id AND c."origenTipo" = 'COMPRA_CREDITO')
),
c_esp AS (
  SELECT d."compraId" AS doc, d.moneda,
         round(dv.cantidad * d."costoUnitario" * (1 - d.descuento / 100) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END, 2) AS amt
  FROM "CompraDetalle" d JOIN "DevolucionCompra" dv ON dv."compraDetalleId" = d.id
  UNION ALL
  SELECT x.doc, x.moneda, round(x.suma, 2) FROM (
    SELECT d."compraId" AS doc, d.moneda,
           sum((d.cantidad - coalesce((SELECT sum(dv.cantidad) FROM "DevolucionCompra" dv WHERE dv."compraDetalleId" = d.id), 0))
               * d."costoUnitario" * (1 - d.descuento / 100) * CASE WHEN d."tipoIva" = 'TOTAL' THEN 1.22 ELSE 1 END) AS suma
    FROM "CompraDetalle" d JOIN "Compra" co ON co.id = d."compraId"
    WHERE co.estado = 'ANULADO'
    GROUP BY d."compraId", d.moneda
  ) x
),
c_real AS (
  SELECT ca.id AS doc, c.moneda, sum(c.haber) AS amt
  FROM cpa ca
  JOIN "CuentaProveedor" c ON c."origenTipo" IN ('DEVOLUCION_COMPRA', 'ANULACION_COMPRA_CREDITO')
   AND (c."origenId" = ca.id OR c."origenId" IN (SELECT dd.id FROM "CompraDetalle" dd WHERE dd."compraId" = ca.id))
  GROUP BY ca.id, c.moneda
),
ajc AS (
  SELECT ca."ferreteriaId", ca."proveedorId" AS entidad, ca.id AS doc, m.moneda,
         coalesce(e.amt, 0) - coalesce(r.amt, 0) AS dif
  FROM cpa ca
  CROSS JOIN (VALUES ('UYU'::"Moneda"), ('USD'::"Moneda")) m(moneda)
  LEFT JOIN (SELECT doc, moneda, sum(amt) AS amt FROM c_esp GROUP BY doc, moneda) e ON e.doc = ca.id AND e.moneda = m.moneda
  LEFT JOIN c_real r ON r.doc = ca.id AND r.moneda = m.moneda
),
ins_clientes AS (
  INSERT INTO "CuentaCliente" (id, "ferreteriaId", "clienteId", fecha, debe, haber, moneda, "origenTipo", "origenId", referencia)
  SELECT 'ajuste-iva-' || gen_random_uuid()::text, "ferreteriaId", entidad, CURRENT_DATE, 0, round(dif, 2), moneda,
         'DEVOLUCION_VENTA'::"OrigenCuentaCliente", doc, 'Ajuste IVA no acreditado en devolución/anulación (' || right(doc, 6) || ')'
  FROM ajv WHERE dif >= 0.01
  RETURNING 1
),
ins_proveedores AS (
  INSERT INTO "CuentaProveedor" (id, "ferreteriaId", "proveedorId", fecha, debe, haber, moneda, "origenTipo", "origenId", referencia)
  SELECT 'ajuste-iva-' || gen_random_uuid()::text, "ferreteriaId", entidad, CURRENT_DATE, 0, round(dif, 2), moneda,
         'DEVOLUCION_COMPRA'::"OrigenCuentaProveedor", doc, 'Ajuste IVA no acreditado en devolución/anulación (' || right(doc, 6) || ')'
  FROM ajc WHERE dif >= 0.01
  RETURNING 1
)
SELECT (SELECT count(*) FROM ins_clientes) AS ajustes_clientes, (SELECT count(*) FROM ins_proveedores) AS ajustes_proveedores;
