import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";

const VENCIMIENTO_MS = 60 * 60_000; // 1 hora

function hashToken(tokenPlano: string): string {
  return createHash("sha256").update(tokenPlano).digest("hex");
}

// El valor que viaja por email es el token en claro; lo único que se guarda
// en VerificationToken es su hash — un volcado de la base nunca da un link
// de reset utilizable.
export async function crearTokenReset(email: string): Promise<string> {
  const tokenPlano = randomBytes(32).toString("hex");

  // Solo un link de reset activo por vez: pedir uno nuevo invalida el anterior.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(tokenPlano),
      expires: new Date(Date.now() + VENCIMIENTO_MS),
    },
  });

  return tokenPlano;
}

// Un solo uso: si es válido, se borra en el mismo paso que se valida.
export async function consumirTokenReset(email: string, tokenPlano: string): Promise<boolean> {
  const tokenHash = hashToken(tokenPlano);

  const registro = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: tokenHash } },
  });

  if (!registro || registro.expires < new Date()) return false;

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token: tokenHash } },
  });

  return true;
}
