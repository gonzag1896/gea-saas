import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Nunca cacheado: cada llamada tiene que llegar a la base de verdad.
export const dynamic = "force-dynamic";

// Ping liviano para el workflow keep-warm (.github/workflows/keep-warm.yml):
// una consulta trivial que despierta el compute de Neon (que se duerme tras
// unos minutos sin uso) antes de que llegue un usuario. No expone datos ni
// detalles del error — solo si la base responde.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
