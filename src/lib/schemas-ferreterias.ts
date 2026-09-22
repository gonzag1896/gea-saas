import { z } from "zod";
import { passwordSchema } from "@/lib/schemas-auth";

export const crearFerreteriaSchema = z.object({
  nombre: z.string().min(1, "El nombre de la ferretería es obligatorio."),
  duenoNombre: z.string().min(1, "El nombre del dueño es obligatorio."),
  duenoEmail: z.string().email("Ingresá un email válido."),
  duenoPassword: passwordSchema,
});

export const registrarPagoPlataformaSchema = z.object({
  fecha: z.string().refine((v) => !isNaN(Date.parse(v)), "Fecha inválida."),
  monto: z.number().positive().optional(),
});
