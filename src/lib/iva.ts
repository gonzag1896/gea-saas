import type { TipoIva } from "@prisma/client";

export const TASA_IVA = 0.22;

// Los totales por línea (total/totalVigente en ventas, costo × cantidad en
// compras) son SIN IVA; lo que se debe en cuenta corriente es neto + IVA.
// Toda devolución o anulación que acredite cuenta corriente tiene que pasar
// por acá, si no queda sin acreditar el IVA de lo devuelto.
export function conIva(neto: number, tipoIva: TipoIva): number {
  return tipoIva === "TOTAL" ? neto * (1 + TASA_IVA) : neto;
}
