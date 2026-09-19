import { z } from "zod";

export const registrarCierreCajaSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  totalContado: z.number().nonnegative("El monto contado no puede ser negativo."),
  observaciones: z.string().optional(),
});
