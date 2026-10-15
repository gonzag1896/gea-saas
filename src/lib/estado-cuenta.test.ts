import { describe, it, expect } from "vitest";
import { armarEstadoCuenta, monedasConMovimientos, conceptoMovimiento, detalleMovimiento, type MovimientoCuenta } from "@/lib/estado-cuenta";

let n = 0;
function mov(p: Partial<MovimientoCuenta> & Pick<MovimientoCuenta, "fecha" | "origenTipo">): MovimientoCuenta {
  n += 1;
  return {
    id: `m${n}`,
    createdAt: `${String(p.fecha).slice(0, 10)}T12:00:${String(n % 60).padStart(2, "0")}.000Z`,
    debe: 0,
    haber: 0,
    moneda: "UYU",
    referencia: null,
    anulado: false,
    montoRecibido: null,
    monedaRecibida: null,
    cotizacion: null,
    ...p,
  };
}

describe("armarEstadoCuenta", () => {
  const movimientos = [
    mov({ fecha: "2026-09-10", origenTipo: "VENTA_CREDITO", debe: 1000 }),
    mov({ fecha: "2026-09-20", origenTipo: "COBRO", haber: 300 }),
    mov({ fecha: "2026-10-03", origenTipo: "VENTA_CREDITO", debe: 500 }),
    mov({ fecha: "2026-10-03", origenTipo: "VENTA_CREDITO", debe: 50, moneda: "USD" }),
  ];

  it("calcula el saldo corriente en orden cronológico, aunque lleguen desordenados", () => {
    const e = armarEstadoCuenta("cliente", [...movimientos].reverse(), "UYU");
    expect(e.filas.map((f) => f.saldo)).toEqual([1000, 700, 1200]);
    expect(e.totalDebe).toBe(1500);
    expect(e.totalHaber).toBe(300);
    expect(e.saldoFinal).toBe(1200);
    expect(e.saldoAnterior).toBe(0);
  });

  it("pesos y dólares son libros separados", () => {
    expect(armarEstadoCuenta("cliente", movimientos, "USD").filas.map((f) => f.saldo)).toEqual([50]);
    expect(monedasConMovimientos(movimientos)).toEqual(["UYU", "USD"]);
    expect(monedasConMovimientos(movimientos.filter((m) => m.moneda === "UYU"))).toEqual(["UYU"]);
  });

  it("con período: lo anterior se resume en el saldo anterior y el corriente arranca desde ahí", () => {
    const e = armarEstadoCuenta("cliente", movimientos, "UYU", { desde: "2026-10-01" });
    expect(e.saldoAnterior).toBe(700);
    expect(e.filas.map((f) => f.saldo)).toEqual([1200]);
    expect(e.totalDebe).toBe(500);
    expect(e.saldoFinal).toBe(1200);
  });

  it("'hasta' corta el período y el saldo final es el de esa fecha", () => {
    const e = armarEstadoCuenta("cliente", movimientos, "UYU", { desde: "2026-09-15", hasta: "2026-09-30" });
    expect(e.saldoAnterior).toBe(1000);
    expect(e.filas.map((f) => f.concepto)).toEqual(["Cobro"]);
    expect(e.saldoFinal).toBe(700);
  });

  it("saldo anterior + debe − haber = saldo final", () => {
    const e = armarEstadoCuenta("cliente", movimientos, "UYU", { desde: "2026-09-15" });
    expect(e.saldoAnterior + e.totalDebe - e.totalHaber).toBe(e.saldoFinal);
  });

  it("no acumula errores de coma flotante", () => {
    const ms = [0.1, 0.2, 0.3].map((d) => mov({ fecha: "2026-10-01", origenTipo: "VENTA_CREDITO", debe: d }));
    expect(armarEstadoCuenta("cliente", ms, "UYU").saldoFinal).toBe(0.6);
  });

  it("sin movimientos devuelve un estado vacío", () => {
    expect(armarEstadoCuenta("proveedor", [], "UYU")).toEqual({ moneda: "UYU", saldoAnterior: 0, filas: [], totalDebe: 0, totalHaber: 0, saldoFinal: 0 });
  });
});

describe("conceptos y detalle", () => {
  it("etiqueta distinto para clientes y proveedores, y marca lo anulado", () => {
    expect(conceptoMovimiento("cliente", { origenTipo: "COBRO", debe: 0, anulado: true })).toBe("Cobro (anulado)");
    expect(conceptoMovimiento("proveedor", { origenTipo: "PAGO", debe: 0, anulado: false })).toBe("Pago");
    expect(conceptoMovimiento("cliente", { origenTipo: "ANULACION_COBRO", debe: 10, anulado: false })).toBe("Anulación de cobro");
  });

  it("el par contado se distingue por lado", () => {
    expect(conceptoMovimiento("cliente", { origenTipo: "VENTA_CONTADO", debe: 100, anulado: false })).toBe("Venta contado");
    expect(conceptoMovimiento("cliente", { origenTipo: "VENTA_CONTADO", debe: 0, anulado: false })).toBe("Cobrado en el acto");
    expect(conceptoMovimiento("proveedor", { origenTipo: "COMPRA_CONTADO", debe: 0, anulado: false })).toBe("Pagado en el acto");
  });

  it("el detalle incluye el cobro cruzado y la referencia", () => {
    const d = detalleMovimiento({ referencia: "Rec. 12", montoRecibido: "10", monedaRecibida: "USD", cotizacion: "40" });
    expect(d).toContain("Recibido US$");
    expect(d).toContain("cotización 40");
    expect(d).toContain("Rec. 12");
    expect(detalleMovimiento({ referencia: null, montoRecibido: null, monedaRecibida: null, cotizacion: null })).toBe("");
  });
});
