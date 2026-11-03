// Estado de cuenta en formato contable (Debe / Haber / Saldo corriente) para
// clientes y proveedores. Lógica pura, compartida por la pantalla y el PDF:
// los dos tienen que mostrar exactamente los mismos números.
//
// Pesos y dólares nunca se mezclan: cada moneda es su propio libro, con su
// saldo corriente. Convención: Saldo = Σ Debe − Σ Haber (positivo = el
// cliente le debe a la ferretería / la ferretería le debe al proveedor).

export type Moneda = "UYU" | "USD";
export type TipoCuenta = "cliente" | "proveedor";

export type MovimientoCuenta = {
  id: string;
  fecha: Date | string;
  createdAt: Date | string;
  debe: number | string;
  haber: number | string;
  moneda: Moneda;
  origenTipo: string;
  // Id del documento que originó el movimiento (la venta, para VENTA_*).
  origenId?: string | null;
  referencia: string | null;
  anulado: boolean;
  montoRecibido: number | string | null;
  monedaRecibida: Moneda | null;
  cotizacion: number | string | null;
};

export type FilaEstado = {
  id: string;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  detalle: string;
  debe: number;
  haber: number;
  saldo: number;
  origenTipo: string;
  origenId: string | null;
  anulado: boolean;
};

export type EstadoMoneda = {
  moneda: Moneda;
  saldoAnterior: number;
  filas: FilaEstado[]; // cronológico, más viejo primero
  totalDebe: number;
  totalHaber: number;
  saldoFinal: number;
};

export type Periodo = { desde?: string; hasta?: string }; // YYYY-MM-DD, inclusivos

const r2 = (n: number) => Math.round(n * 100) / 100;
const dia = (f: Date | string) => (typeof f === "string" ? f.slice(0, 10) : f.toISOString().slice(0, 10));
const instante = (f: Date | string) => (typeof f === "string" ? f : f.toISOString());

export const simboloMoneda = (m: Moneda) => (m === "USD" ? "US$" : "$");

export function formatearMonto(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ETIQUETAS: Record<TipoCuenta, Record<string, string>> = {
  cliente: {
    VENTA_CREDITO: "Venta a crédito",
    COBRO: "Cobro",
    DEVOLUCION_VENTA: "Devolución",
    ANULACION_VENTA_CREDITO: "Anulación de venta",
    ANULACION_COBRO: "Anulación de cobro",
  },
  proveedor: {
    COMPRA_CREDITO: "Compra a crédito",
    PAGO: "Pago",
    DEVOLUCION_COMPRA: "Devolución",
    ANULACION_COMPRA_CREDITO: "Anulación de compra",
    ANULACION_PAGO: "Anulación de pago",
  },
};

export function conceptoMovimiento(tipo: TipoCuenta, m: Pick<MovimientoCuenta, "origenTipo" | "debe" | "anulado">): string {
  let base: string;
  if (m.origenTipo === "VENTA_CONTADO" || m.origenTipo === "COMPRA_CONTADO") {
    // Una venta/compra al contado deja el par Debe + Haber: la misma
    // etiqueta de origen sirve para las dos filas, se distinguen por lado.
    const esDebe = Number(m.debe) > 0;
    base = tipo === "cliente" ? (esDebe ? "Venta contado" : "Cobrado en el acto") : esDebe ? "Compra contado" : "Pagado en el acto";
  } else {
    base = ETIQUETAS[tipo][m.origenTipo] ?? m.origenTipo;
  }
  return m.anulado ? `${base} (anulado)` : base;
}

// Referencia escrita por el usuario + el detalle del cobro/pago cruzado
// (se paga una deuda en una moneda con la otra) si lo hubo.
export function detalleMovimiento(m: Pick<MovimientoCuenta, "referencia" | "montoRecibido" | "monedaRecibida" | "cotizacion">): string {
  const partes: string[] = [];
  if (m.montoRecibido !== null && m.monedaRecibida) {
    partes.push(`Recibido ${simboloMoneda(m.monedaRecibida)} ${formatearMonto(Number(m.montoRecibido))} a cotización ${Number(m.cotizacion)}`);
  }
  if (m.referencia) partes.push(m.referencia);
  return partes.join(" · ");
}

export function monedasConMovimientos(movimientos: Pick<MovimientoCuenta, "moneda">[]): Moneda[] {
  return (["UYU", "USD"] as const).filter((m) => movimientos.some((x) => x.moneda === m));
}

export function armarEstadoCuenta(
  tipo: TipoCuenta,
  movimientos: MovimientoCuenta[],
  moneda: Moneda,
  periodo: Periodo = {},
): EstadoMoneda {
  // Orden contable: por fecha del movimiento y, dentro del mismo día, por
  // orden de carga.
  const ordenados = movimientos
    .filter((m) => m.moneda === moneda)
    .sort((a, b) => dia(a.fecha).localeCompare(dia(b.fecha)) || instante(a.createdAt).localeCompare(instante(b.createdAt)));

  let saldo = 0;
  let saldoAnterior = 0;
  let totalDebe = 0;
  let totalHaber = 0;
  const filas: FilaEstado[] = [];

  for (const m of ordenados) {
    const d = dia(m.fecha);
    const debe = Number(m.debe);
    const haber = Number(m.haber);
    if (periodo.desde && d < periodo.desde) {
      // Todo lo anterior al período se resume en el "saldo anterior".
      saldo = r2(saldo + debe - haber);
      saldoAnterior = saldo;
      continue;
    }
    if (periodo.hasta && d > periodo.hasta) continue;

    saldo = r2(saldo + debe - haber);
    totalDebe = r2(totalDebe + debe);
    totalHaber = r2(totalHaber + haber);
    filas.push({
      id: m.id,
      fecha: d,
      concepto: conceptoMovimiento(tipo, m),
      detalle: detalleMovimiento(m),
      debe,
      haber,
      saldo,
      origenTipo: m.origenTipo,
      origenId: m.origenId ?? null,
      anulado: m.anulado,
    });
  }

  return { moneda, saldoAnterior, filas, totalDebe, totalHaber, saldoFinal: saldo };
}

export function formatearDia(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// ---------------------------------------------------------------------------
// Detalle de compras (lo que el cliente compró) para acompañar el estado de
// cuenta. Las ventas listadas son EXACTAMENTE las que tienen un cargo (Debe)
// en el estado del período descargado, así los montos coinciden con él.
// ---------------------------------------------------------------------------

// Acepta también los Decimal de Prisma (se leen con Number()).
type Numerico = number | string | { toString(): string };

export type VentaParaDetalle = {
  id: string;
  fecha: Date | string;
  medioPago: string;
  estado: string;
  subtotalUYU: Numerico;
  ivaUYU: Numerico;
  totalUYU: Numerico;
  subtotalUSD: Numerico;
  ivaUSD: Numerico;
  totalUSD: Numerico;
  detalle: {
    cantidad: number;
    cantidadDevuelta: number;
    precio: Numerico;
    moneda: Moneda;
    descuento: Numerico;
    tipoIva: string;
    total: Numerico;
    producto: { codigo: string; descripcion: string };
  }[];
};

export type LineaCompra = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  devuelta: number;
  precio: number;
  moneda: Moneda;
  descuento: number;
  iva: boolean;
  importe: number; // neto de la línea (sin IVA), ya con descuento
};

export type CompraDetallada = {
  id: string;
  numero: string;
  fecha: string; // YYYY-MM-DD
  medioPago: string;
  anulada: boolean;
  lineas: LineaCompra[];
  totales: { moneda: Moneda; subtotal: number; iva: number; total: number }[];
};

const ETIQUETA_MEDIO_PAGO: Record<string, string> = { CONTADO: "Contado", CREDITO: "Crédito", DEBITO: "Débito", TRANSFERENCIA: "Transferencia" };
export const etiquetaMedioPago = (m: string) => ETIQUETA_MEDIO_PAGO[m] ?? m;

// Ids de las ventas con un cargo en el estado de cuenta (todas las monedas).
export function idsVentasDelEstado(estados: EstadoMoneda[]): string[] {
  const ids = new Set<string>();
  for (const estado of estados) {
    for (const f of estado.filas) {
      if ((f.origenTipo === "VENTA_CREDITO" || f.origenTipo === "VENTA_CONTADO") && f.debe > 0 && f.origenId) ids.add(f.origenId);
    }
  }
  return Array.from(ids);
}

export function armarDetalleCompras(ventas: VentaParaDetalle[], estados: EstadoMoneda[]) {
  const enEstado = new Set(idsVentasDelEstado(estados));

  const compras: CompraDetallada[] = ventas
    .filter((v) => enEstado.has(v.id))
    .map((v) => ({
      id: v.id,
      // Mismo número que muestra el ticket de la venta (N.° …), para poder cruzarlos.
      numero: v.id.slice(-8).toUpperCase(),
      fecha: dia(v.fecha),
      medioPago: etiquetaMedioPago(v.medioPago),
      anulada: v.estado === "ANULADO",
      lineas: v.detalle.map((l) => ({
        codigo: l.producto.codigo,
        descripcion: l.producto.descripcion,
        cantidad: l.cantidad,
        devuelta: l.cantidadDevuelta,
        precio: Number(l.precio),
        moneda: l.moneda,
        descuento: Number(l.descuento),
        iva: l.tipoIva === "TOTAL",
        importe: Number(l.total),
      })),
      totales: (
        [
          { moneda: "UYU" as const, subtotal: Number(v.subtotalUYU), iva: Number(v.ivaUYU), total: Number(v.totalUYU) },
          { moneda: "USD" as const, subtotal: Number(v.subtotalUSD), iva: Number(v.ivaUSD), total: Number(v.totalUSD) },
        ]
      ).filter((t) => t.total > 0),
    }));

  // Lo que el estado de cuenta suma como cargos por ventas, por moneda: es la
  // referencia contra la que tiene que cerrar el detalle.
  const totalEstado = { UYU: 0, USD: 0 };
  for (const estado of estados) {
    for (const f of estado.filas) {
      if (f.origenTipo === "VENTA_CREDITO" || f.origenTipo === "VENTA_CONTADO") totalEstado[estado.moneda] = r2(totalEstado[estado.moneda] + f.debe);
    }
  }
  const totalDetalle = { UYU: 0, USD: 0 };
  for (const c of compras) for (const t of c.totales) totalDetalle[t.moneda] = r2(totalDetalle[t.moneda] + t.total);

  return { compras, totalEstado, totalDetalle, cierra: totalEstado.UYU === totalDetalle.UYU && totalEstado.USD === totalDetalle.USD };
}
