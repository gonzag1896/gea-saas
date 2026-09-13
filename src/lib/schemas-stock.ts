import { z } from "zod";

export const ajusteStockSchema = z.object({
  tipo: z.enum(["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0."),
  motivo: z.string().min(1, "El motivo es obligatorio."),
});
