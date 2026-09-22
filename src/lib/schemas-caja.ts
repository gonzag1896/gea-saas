import { z } from "zod";

export const registrarCierreCajaSchema = z.object({
  desde: z.string().min(1, "La fecha es obligatoria."),
  // Opcional: si no se manda, el cierre es de un solo día (desde === hasta).
  hasta: z.string().optional(),
  montoInicial: z.number().nonnegative("El fondo inicial no puede ser negativo.").default(0),
  totalContado: z.number().nonnegative("El monto contado no puede ser negativo."),
  observaciones: z.string().optional(),
});

export const actualizarCierreCajaSchema = z.object({
  montoInicial: z.number().nonnegative("El fondo inicial no puede ser negativo.").optional(),
  totalContado: z.number().nonnegative("El monto contado no puede ser negativo.").optional(),
  observaciones: z.string().optional(),
});
