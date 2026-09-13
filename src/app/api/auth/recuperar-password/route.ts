import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crearTokenReset } from "@/lib/password-reset";
import { enviarEmailRecuperacion } from "@/lib/email";
import { dentroDelLimite, obtenerIp } from "@/lib/rate-limit";
import { auditar } from "@/lib/auditoria";
import { solicitarResetSchema } from "@/lib/schemas-auth";

// Respuesta única, exista o no la cuenta: pedir reset no puede usarse para
// averiguar qué emails están registrados (Revisión técnica final, §5).
const RESPUESTA_GENERICA = { ok: true, mensaje: "Si existe una cuenta con ese email, te enviamos instrucciones." };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = solicitarResetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Email inválido." }, { status: 400 });

  const { email } = parsed.data;
  const ip = obtenerIp(req.headers);

  // Rate limit por email Y por IP: sin esto, este endpoint es un oráculo de
  // existencia de cuentas (probar muchos emails) o un medio de acoso
  // (inundar la bandeja de una persona con links de reset).
  const dentroLimiteEmail = await dentroDelLimite(`reset:${email}`, 3, 15 * 60_000);
  const dentroLimiteIp = await dentroDelLimite(`reset:ip:${ip}`, 20, 15 * 60_000);
  if (!dentroLimiteEmail || !dentroLimiteIp) return NextResponse.json(RESPUESTA_GENERICA);

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (usuario && usuario.estado !== "INACTIVO") {
    const tokenPlano = await crearTokenReset(email);
    // El origen sale del propio request, no de una env var fija: en local
    // el puerto puede variar (3000 ocupado → Next arranca en 3001), y un
    // NEXTAUTH_URL fijo generaría links de reset a un host equivocado.
    const urlReset = `${new URL(req.url).origin}/restablecer-password/${tokenPlano}?email=${encodeURIComponent(email)}`;

    try {
      await enviarEmailRecuperacion(email, urlReset);
      await auditar({ accion: "PASSWORD_RESET_SOLICITADO", usuarioId: usuario.id, ip });
    } catch (error) {
      // Si el envío falla (proveedor caído, o todavía sin RESEND_API_KEY en
      // desarrollo) igual hay que devolver la respuesta genérica: un 500
      // solo para cuentas existentes es la misma fuga por enumeración que
      // se evitó en el mensaje, ahora por status code.
      console.error("[recuperar-password] no se pudo enviar el email", error);
    }
  }

  return NextResponse.json(RESPUESTA_GENERICA);
}
