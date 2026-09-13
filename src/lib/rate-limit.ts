import { prisma } from "@/lib/db";

// Ventana fija: una fila por (clave, ventana) que se incrementa. Sin job de
// limpieza — el volumen es chico y las filas viejas no se vuelven a leer
// (ver comentario en el modelo RateLimit de schema.prisma).
export async function dentroDelLimite(clave: string, maxIntentos: number, ventanaMs: number): Promise<boolean> {
  const ventana = new Date(Math.floor(Date.now() / ventanaMs) * ventanaMs);

  const registro = await prisma.rateLimit.upsert({
    where: { clave_ventana: { clave, ventana } },
    update: { cantidad: { increment: 1 } },
    create: { clave, ventana, cantidad: 1 },
  });

  return registro.cantidad <= maxIntentos;
}

// `request.headers` no siempre trae "x-forwarded-for" en local (Docker/dev
// server), así que un IP ausente no debe tumbar el rate limiting: cae a un
// valor fijo, que en desarrollo simplemente comparte el mismo balde.
export function obtenerIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "desconocida";
}
