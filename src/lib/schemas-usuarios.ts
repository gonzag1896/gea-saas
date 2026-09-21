import { z } from "zod";
import { passwordSchema } from "@/lib/schemas-auth";

export const crearUsuarioSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  nombre: z.string().min(1, "El nombre es obligatorio."),
  rol: z.enum(["DUENO", "CAJERO", "DEPOSITO"]),
  password: passwordSchema,
});

export const actualizarUsuarioSchema = z.object({
  rol: z.enum(["DUENO", "CAJERO", "DEPOSITO"]).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});
