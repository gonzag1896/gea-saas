import { z } from "zod";

const lineaCompraSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0."),
  costoUnitario: z.number().nonnegative(),
  // Puntos porcentuales (0-100), no un monto en $.
  descuento: z.number().min(0, "El descuento no puede ser negativo.").max(100, "El descuento no puede superar el 100%.").default(0),
  tipoIva: z.enum(["EXENTO", "TOTAL"]).default("EXENTO"),
});

export const crearCompraSchema = z.object({
  proveedorId: z.string().min(1, "El proveedor es obligatorio."),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  numeroFactura: z.string().optional(),
  facturaPdfUrl: z.string().url().optional().or(z.literal("")),
  observaciones: z.string().optional(),
  medioPago: z.enum(["CONTADO", "CREDITO", "DEBITO"]).default("CONTADO"),
  detalle: z.array(lineaCompraSchema).min(1, "La compra necesita al menos una línea."),
});

export const anularCompraSchema = z.object({
  motivo: z.string().min(1, "El motivo de anulación es obligatorio."),
});

export const devolucionCompraSchema = z.object({
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0."),
  motivo: z.string().optional(),
});
