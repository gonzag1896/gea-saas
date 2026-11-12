import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuthCard } from "@/components/ui/AuthCard";
import { SeleccionarFerreteriaForm } from "./SeleccionarFerreteriaForm";

// A esta pantalla se llega de tres formas: un usuario con 0 o ≥2
// membresías activas que todavía no tiene ferretería elegida (ver
// (app)/layout.tsx), alguien que ya tiene una activa pero quiere cambiar a
// otra ("Cambiar de ferretería" en el header), o un Super Admin que quiere
// entrar en modo soporte. Por eso NO redirige a /dashboard cuando ya hay
// una ferretería elegida — sería imposible cambiarla. La administración de
// tenants (alta de ferreterías nuevas) vive aparte, en /admin/ferreterias
// — acá solo se resuelve "a qué ferretería entro ahora".
export default async function SeleccionarFerreteriaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.isSuperAdmin) {
    // Todas, también las que tienen el acceso inhabilitado por cuota vencida:
    // el Super Admin tiene que poder entrar a verlas (y se marcan para que se vea).
    const filas = await prisma.ferreteria.findMany({
      select: { id: true, nombre: true, estado: true },
      orderBy: { nombre: "asc" },
    });
    const ferreterias = filas.map((f) => ({ id: f.id, nombre: f.estado === "INACTIVO" ? `${f.nombre} · acceso inhabilitado` : f.nombre }));
    return (
      <AuthCard title="Modo soporte" description="Elegí una ferretería para entrar en modo lectura como soporte.">
        <SeleccionarFerreteriaForm items={ferreterias} modoSoporte />
        <Link
          href="/admin/ferreterias"
          className="mt-4 block text-center text-sm text-primary underline underline-offset-2"
        >
          Administrar ferreterías
        </Link>
      </AuthCard>
    );
  }

  const membresias = await prisma.ferreteriaUsuario.findMany({
    where: { usuarioId: session.user.id, estado: "ACTIVO" },
    include: { ferreteria: true },
  });

  return (
    <AuthCard title="Elegir ferretería">
      <SeleccionarFerreteriaForm
        items={membresias.map((m) => ({ id: m.ferreteriaId, nombre: m.ferreteria.nombre, rol: m.rol }))}
        modoSoporte={false}
      />
    </AuthCard>
  );
}
