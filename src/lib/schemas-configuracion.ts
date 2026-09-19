import { z } from "zod";

export const actualizarCotizacionSchema = z.object({
  cotizacionDolar: z.number().positive("La cotización tiene que ser mayor a 0."),
});
