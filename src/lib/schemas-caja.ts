import { z } from "zod";

export const registrarCierreCajaSchema = z.object({
  desde: z.string().min(1, "La fecha es obligatoria."),
  // Opcional: si no se manda, el cierre es de un solo día (desde === hasta).
  hasta: z.string().optional(),
  montoInicialUYU: z.number().nonnegative("El fondo inicial no puede ser negativo.").default(0),
  montoInicialUSD: z.number().nonnegative("El fondo inicial no puede ser negativo.").default(0),
  totalContadoUYU: z.number().nonnegative("El monto contado no puede ser negativo.").default(0),
  totalContadoUSD: z.number().nonnegative("El monto contado no puede ser negativo.").default(0),
  observaciones: z.string().optional(),
});

export const actualizarCierreCajaSchema = z.object({
  montoInicialUYU: z.number().nonnegative("El fondo inicial no puede ser negativo.").optional(),
  montoInicialUSD: z.number().nonnegative("El fondo inicial no puede ser negativo.").optional(),
  totalContadoUYU: z.number().nonnegative("El monto contado no puede ser negativo.").optional(),
  totalContadoUSD: z.number().nonnegative("El monto contado no puede ser negativo.").optional(),
  observaciones: z.string().optional(),
});
