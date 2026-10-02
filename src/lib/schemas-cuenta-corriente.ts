import { z } from "zod";

export const anularMovimientoSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo de anulación es obligatorio."),
});

export const registrarCobroSchema = z
  .object({
    // Lo que realmente se entrega, en `monedaRecibida` (o en `moneda` si no
    // se indica otra).
    monto: z.number().positive("El monto debe ser mayor a 0."),
    // Moneda de la deuda que cancela. Un cobro/pago es siempre en una sola
    // moneda — si paga parte en pesos y parte en dólares, son dos cobros.
    moneda: z.enum(["UYU", "USD"]).default("UYU"),
    // Solo si paga en la otra moneda (cobro cruzado): requiere cotización.
    monedaRecibida: z.enum(["UYU", "USD"]).optional(),
    cotizacion: z.number().positive("La cotización debe ser mayor a 0.").optional(),
    referencia: z.string().optional(),
    medioPago: z.enum(["CONTADO", "TRANSFERENCIA", "DEBITO"]).default("CONTADO"),
  })
  .refine((d) => !d.monedaRecibida || d.monedaRecibida === d.moneda || d.cotizacion !== undefined, {
    message: "Indicá la cotización para cobrar en otra moneda.",
    path: ["cotizacion"],
  });
