import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { cambiarPasswordSchema } from "@/lib/schemas-auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = cambiarPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { passwordActual, passwordNueva } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id } });
  if (!usuario?.passwordHash) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!valido) return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });

  const passwordHash = await bcrypt.hash(passwordNueva, 12);
  await prisma.usuario.update({
    where: { id: usuario.id },
    // Corta cualquier otra sesión abierta con la contraseña vieja (ver
    // lib/validar-sesion.ts) — no solo la de este dispositivo.
    data: { passwordHash, passwordCambiadoAt: new Date() },
  });

  await auditar({ accion: "PASSWORD_CAMBIO", usuarioId: usuario.id });

  return NextResponse.json({ ok: true });
}
