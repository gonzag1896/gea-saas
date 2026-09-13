import { z } from "zod";

// Política mínima: longitud pesa más que complejidad forzada (Revisión
// técnica final, sección 5) — sin exigir símbolos/mayúsculas obligatorios.
export const passwordSchema = z.string().min(10, "La contraseña debe tener al menos 10 caracteres.");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const solicitarResetSchema = z.object({
  email: z.string().email(),
});

export const restablecerPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: passwordSchema,
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: passwordSchema,
});
