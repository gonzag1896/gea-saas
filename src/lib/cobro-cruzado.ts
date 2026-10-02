import type { Moneda } from "@prisma/client";
import { EstadoInvalidoError } from "@/lib/errores-dominio";

export type Cruce = { monedaRecibida: Moneda; cotizacion: number };

// Un cobro/pago cruzado es cuando se paga una deuda en una moneda con la
// otra (deuda en pesos, paga en dólares o al revés). `monto` es siempre lo
// que realmente se entregó, en `monedaRecibida`; acá se calcula cuánto baja
// la deuda en su propia moneda (sin override manual a propósito: un solo
// camino, fácil de auditar). Si no hay cruce, `haber` es el monto tal cual.
export function resolverMontos(monto: number, moneda: Moneda, cruce?: Cruce) {
  if (!cruce || cruce.monedaRecibida === moneda) return { haber: monto };
  if (!(cruce.cotizacion > 0)) throw new EstadoInvalidoError("Indicá la cotización del dólar para un cobro en otra moneda.");
  const equivalente = moneda === "UYU" ? monto * cruce.cotizacion : monto / cruce.cotizacion;
  return {
    haber: Math.round(equivalente * 100) / 100,
    montoRecibido: monto,
    monedaRecibida: cruce.monedaRecibida,
    cotizacion: cruce.cotizacion,
  };
}
