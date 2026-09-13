import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumirTokenReset } from "@/lib/password-reset";
import { auditar } from "@/lib/auditoria";
import { restablecerPasswordSchema } from "@/lib/schemas-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = restablecerPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { email, token, password } = parsed.data;

  const tokenValido = await consumirTokenReset(email, token);
  if (!tokenValido) return NextResponse.json({ error: "El link de recuperación es inválido o venció." }, { status: 400 });

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return NextResponse.json({ error: "El link de recuperación es inválido o venció." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      // Corta cualquier sesión emitida antes de este momento (ver
      // lib/validar-sesion.ts) y limpia un bloqueo por intentos si lo había.
      passwordCambiadoAt: new Date(),
      intentosFallidos: 0,
      bloqueadoHasta: null,
      estado: usuario.estado === "INVITADO" ? "ACTIVO" : usuario.estado,
    },
  });

  await auditar({ accion: "PASSWORD_RESET_COMPLETADO", usuarioId: usuario.id });

  return NextResponse.json({ ok: true });
}
