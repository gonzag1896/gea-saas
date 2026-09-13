import { z } from "zod";

const lineaVentaSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0."),
  precio: z.number().nonnegative(),
  descuento: z.number().nonnegative().default(0),
});

export const crearVentaSchema = z.object({
  clienteId: z.string().min(1, "El cliente es obligatorio."),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  tipoIva: z.enum(["EXENTO", "TOTAL"]).default("EXENTO"),
  medioPago: z.enum(["CONTADO", "CREDITO", "TRANSFERENCIA"]).default("CONTADO"),
  entrega: z.number().nonnegative().default(0),
  detalle: z.array(lineaVentaSchema).min(1, "La venta necesita al menos una línea."),
});

export const anularVentaSchema = z.object({
  motivo: z.string().min(1, "El motivo de anulación es obligatorio."),
});

export const devolucionVentaSchema = z.object({
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0."),
  motivo: z.string().optional(),
});
