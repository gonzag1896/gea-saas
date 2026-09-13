import { z } from "zod";

export const registrarCobroSchema = z.object({
  monto: z.number().positive("El monto debe ser mayor a 0."),
  referencia: z.string().optional(),
});
