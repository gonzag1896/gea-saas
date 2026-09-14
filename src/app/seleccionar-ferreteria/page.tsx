import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SeleccionarFerreteriaForm } from "./SeleccionarFerreteriaForm";

// A esta pantalla se llega de tres formas: un usuario con 0 o ≥2
// membresías activas que todavía no tiene ferretería elegida (ver
// (app)/layout.tsx), alguien que ya tiene una activa pero quiere cambiar a
// otra ("Cambiar de ferretería" en el header), o un Super Admin que quiere
// entrar en modo soporte. Por eso NO redirige a /dashboard cuando ya hay
// una ferretería elegida — sería imposible cambiarla. No es un panel de
// administración de tenants (eso es un módulo aparte, fuera de esta
// fase) — acá solo se resuelve "a qué ferretería entro ahora".
export default async function SeleccionarFerreteriaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.isSuperAdmin) {
    const ferreterias = await prisma.ferreteria.findMany({
      where: { estado: "ACTIVO" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    return (
      <main className="flex flex-col gap-4 p-10">
        <h1 className="text-xl font-semibold text-foreground">Modo soporte</h1>
        <p className="text-sm text-muted-foreground">Elegí una ferretería para entrar en modo lectura como soporte.</p>
        <SeleccionarFerreteriaForm items={ferreterias} modoSoporte />
      </main>
    );
  }

  const membresias = await prisma.ferreteriaUsuario.findMany({
    where: { usuarioId: session.user.id, estado: "ACTIVO" },
    include: { ferreteria: true },
  });

  return (
    <main className="flex flex-col gap-4 p-10">
      <h1 className="text-xl font-semibold text-foreground">Elegir ferretería</h1>
      <SeleccionarFerreteriaForm
        items={membresias.map((m) => ({ id: m.ferreteriaId, nombre: m.ferreteria.nombre, rol: m.rol }))}
        modoSoporte={false}
      />
    </main>
  );
}
