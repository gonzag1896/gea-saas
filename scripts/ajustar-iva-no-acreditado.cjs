/* eslint-disable */
// Corrige los saldos de cuenta corriente (clientes y proveedores) afectados
// por el bug de IVA: antes de d540d2c, devolver artículos o anular una
// venta/compra a crédito acreditaba solo el neto, sin el 22% de IVA.
//
// Por defecto SOLO LEE y muestra qué ajustaría. Escribe únicamente con --aplicar.
// Es idempotente: cuenta los ajustes ya hechos, así que correrlo dos veces no duplica.
//
// Uso (PowerShell, desde C:\Apps\GEA):
//   $env:DATABASE_URL = "<url de producción>"
//   node scripts/ajustar-iva-no-acreditado.cjs            # simulación
//   node scripts/ajustar-iva-no-acreditado.cjs --aplicar  # escribe
const { PrismaClient } = require("@prisma/client");

const APLICAR = process.argv.includes("--aplicar");
// Opcional: limitar a una sola ferretería (--ferreteria=<id>).
const FERRETERIA = (process.argv.find((a) => a.startsWith("--ferreteria=")) ?? "").slice("--ferreteria=".length) || undefined;
const filtroFerreteria = FERRETERIA ? { ferreteriaId: FERRETERIA } : {};
const IVA = 1.22;
const PREFIJO = "Ajuste IVA no acreditado";
const r2 = (n) => Math.round(n * 100) / 100;
const factor = (tipoIva) => (tipoIva === "TOTAL" ? IVA : 1);

const prisma = new PrismaClient();

function host() {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "(DATABASE_URL inválida)";
  }
}

// Suma por moneda: { UYU, USD }
const cero = () => ({ UYU: 0, USD: 0 });

async function ajustesVentas() {
  const ventas = await prisma.venta.findMany({
    where: {
      ...filtroFerreteria,
      medioPago: "CREDITO",
      OR: [{ estado: "ANULADO" }, { detalle: { some: { cantidadDevuelta: { gt: 0 } } } }],
    },
    include: {
      cliente: { select: { nombre: true } },
      ferreteria: { select: { nombre: true } },
      detalle: { include: { devoluciones: true } },
    },
  });
  const ids = ventas.flatMap((v) => [v.id, ...v.detalle.map((d) => d.id)]);
  const filas = await prisma.cuentaCliente.findMany({
    where: { origenId: { in: ids }, origenTipo: { in: ["VENTA_CREDITO", "DEVOLUCION_VENTA", "ANULACION_VENTA_CREDITO"] } },
  });

  const out = [];
  for (const v of ventas) {
    const idsVenta = new Set([v.id, ...v.detalle.map((d) => d.id)]);
    const propias = filas.filter((f) => idsVenta.has(f.origenId));
    const confirmadaACredito = propias.some((f) => f.origenTipo === "VENTA_CREDITO");
    if (!confirmadaACredito) continue; // anulada sin haber sido confirmada: no hubo asiento

    const esperado = cero();
    for (const d of v.detalle) {
      for (const dev of d.devoluciones) {
        esperado[d.moneda] += r2(((Number(d.total) * dev.cantidad) / d.cantidad) * factor(d.tipoIva));
      }
    }
    if (v.estado === "ANULADO") {
      const porMoneda = cero();
      for (const d of v.detalle) porMoneda[d.moneda] += Number(d.totalVigente) * factor(d.tipoIva);
      esperado.UYU += r2(porMoneda.UYU);
      esperado.USD += r2(porMoneda.USD);
    }

    const real = cero();
    for (const f of propias) if (f.origenTipo !== "VENTA_CREDITO") real[f.moneda] += Number(f.haber);

    for (const moneda of ["UYU", "USD"]) {
      const dif = r2(esperado[moneda] - real[moneda]);
      if (Math.abs(dif) >= 0.01) {
        out.push({ ferreteriaId: v.ferreteriaId, ferreteria: v.ferreteria.nombre, entidadId: v.clienteId, entidad: v.cliente.nombre, docId: v.id, fecha: v.fecha, moneda, dif, tipo: "cliente" });
      }
    }
  }
  return out;
}

async function ajustesCompras() {
  const compras = await prisma.compra.findMany({
    where: {
      ...filtroFerreteria,
      medioPago: "CREDITO",
      OR: [{ estado: "ANULADO" }, { detalle: { some: { devoluciones: { some: {} } } } }],
    },
    include: {
      proveedor: { select: { nombre: true } },
      ferreteria: { select: { nombre: true } },
      detalle: { include: { devoluciones: true } },
    },
  });
  const ids = compras.flatMap((c) => [c.id, ...c.detalle.map((d) => d.id)]);
  const filas = await prisma.cuentaProveedor.findMany({
    where: { origenId: { in: ids }, origenTipo: { in: ["COMPRA_CREDITO", "DEVOLUCION_COMPRA", "ANULACION_COMPRA_CREDITO"] } },
  });

  const out = [];
  for (const c of compras) {
    const idsCompra = new Set([c.id, ...c.detalle.map((d) => d.id)]);
    const propias = filas.filter((f) => idsCompra.has(f.origenId));
    if (!propias.some((f) => f.origenTipo === "COMPRA_CREDITO")) continue;

    const neto = (d) => Number(d.costoUnitario) * (1 - Number(d.descuento) / 100);
    const esperado = cero();
    for (const d of c.detalle) {
      for (const dev of d.devoluciones) esperado[d.moneda] += r2(dev.cantidad * neto(d) * factor(d.tipoIva));
    }
    if (c.estado === "ANULADO") {
      const porMoneda = cero();
      for (const d of c.detalle) {
        const yaDevuelto = d.devoluciones.reduce((acc, x) => acc + x.cantidad, 0);
        porMoneda[d.moneda] += (d.cantidad - yaDevuelto) * neto(d) * factor(d.tipoIva);
      }
      esperado.UYU += r2(porMoneda.UYU);
      esperado.USD += r2(porMoneda.USD);
    }

    const real = cero();
    for (const f of propias) if (f.origenTipo !== "COMPRA_CREDITO") real[f.moneda] += Number(f.haber);

    for (const moneda of ["UYU", "USD"]) {
      const dif = r2(esperado[moneda] - real[moneda]);
      if (Math.abs(dif) >= 0.01) {
        out.push({ ferreteriaId: c.ferreteriaId, ferreteria: c.ferreteria.nombre, entidadId: c.proveedorId, entidad: c.proveedor.nombre, docId: c.id, fecha: c.fecha, moneda, dif, tipo: "proveedor" });
      }
    }
  }
  return out;
}

async function main() {
  console.log(`Base de datos: ${host()}`);
  console.log(APLICAR ? "MODO: APLICAR (escribe)\n" : "MODO: simulación (no escribe nada)\n");

  const todos = [...(await ajustesVentas()), ...(await ajustesCompras())];
  if (todos.length === 0) {
    console.log("No hay diferencias. Nada para corregir.");
    return;
  }

  for (const a of todos) {
    const signo = a.dif > 0 ? "+" : "";
    console.log(`${a.ferreteria} | ${a.tipo} ${a.entidad} | ${a.moneda === "USD" ? "US$" : "$"} ${signo}${a.dif.toFixed(2)} a acreditar | doc ${a.docId} (${a.fecha.toISOString().slice(0, 10)})`);
  }

  const negativos = todos.filter((a) => a.dif < 0);
  if (negativos.length) console.log(`\nATENCIÓN: ${negativos.length} diferencia(s) negativa(s) (se acreditó de más). Esas NO se aplican; revisalas a mano.`);
  const aAplicar = todos.filter((a) => a.dif > 0);

  const resumen = new Map();
  for (const a of aAplicar) {
    const k = `${a.ferreteria} | ${a.tipo} ${a.entidad} | ${a.moneda}`;
    resumen.set(k, r2((resumen.get(k) ?? 0) + a.dif));
  }
  console.log("\nTotal por cliente/proveedor:");
  for (const [k, v] of resumen) console.log(`  ${k}: ${v.toFixed(2)}`);

  if (!APLICAR) {
    console.log(`\n${aAplicar.length} ajuste(s) pendientes. Para aplicarlos: node scripts/ajustar-iva-no-acreditado.cjs --aplicar`);
    return;
  }

  const ops = aAplicar.map((a) => {
    const referencia = `${PREFIJO} en devolución/anulación (${a.docId.slice(-6)})`;
    const comun = { ferreteriaId: a.ferreteriaId, fecha: new Date(), debe: 0, haber: a.dif, moneda: a.moneda, origenId: a.docId, referencia };
    return a.tipo === "cliente"
      ? prisma.cuentaCliente.create({ data: { ...comun, clienteId: a.entidadId, origenTipo: "DEVOLUCION_VENTA" } })
      : prisma.cuentaProveedor.create({ data: { ...comun, proveedorId: a.entidadId, origenTipo: "DEVOLUCION_COMPRA" } });
  });
  await prisma.$transaction(ops);
  console.log(`\nListo: ${ops.length} movimiento(s) de ajuste creados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
