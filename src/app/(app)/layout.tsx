import { redirect } from "next/navigation";
import { obtenerSesionValidada } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { diasHastaUruguay, formatearFecha } from "@/lib/fecha";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SidebarMarginAdjuster } from "./sidebar-margin-adjuster";
import { AvisoVigencia } from "./aviso-vigencia";

// Guardia de todo lo que cuelga de (app): sin sesión, con una sesión vieja
// (contraseña cambiada o membresía revocada después de emitido el token),
// o sin una ferretería activa todavía, no se entra al contenido.
//
// Usa el mismo obtenerSesionValidada() cacheado por request que
// obtenerContextoTenant() — cada page.tsx de acá abajo lo vuelve a llamar,
// y sin el cache() de por medio eso eran 2 consultas de sesión de más en
// cada navegación.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await obtenerSesionValidada();
  if (!session?.user) redirect("/login");

  // Un Super Admin puro (sin ferretería prestada en modo soporte) no
  // necesita elegir ninguna — su panel es de plataforma, no de negocio
  // (fuera de alcance de esta fase). Cualquier otro usuario sin ferretería
  // activa todavía (0 o ≥2 membresías) va al selector.
  if (!session.user.ferreteriaId && !session.user.isSuperAdmin) {
    redirect("/seleccionar-ferreteria");
  }

  // Aviso de vencimiento de la mensualidad de la plataforma: solo al
  // Dueño (es quien paga), no a Cajero/Depósito ni al Super Admin en
  // modo soporte. 3 días de antelación o menos, incluyendo si ya venció.
  let diasParaVencer: number | null = null;
  let vigenciaHasta: Date | null = null;
  if (session.user.rol === "DUENO" && session.user.ferreteriaId && !session.user.soporte) {
    const ferreteria = await prisma.ferreteria.findUnique({
      where: { id: session.user.ferreteriaId },
      select: { vigenciaHasta: true },
    });
    if (ferreteria?.vigenciaHasta) {
      vigenciaHasta = ferreteria.vigenciaHasta;
      diasParaVencer = diasHastaUruguay(ferreteria.vigenciaHasta);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar rol={session.user.rol} />
      <SidebarMarginAdjuster>
        <Header
          email={session.user.email ?? ""}
          ferreteriaId={session.user.ferreteriaId}
          ferreteriaNombre={session.user.ferreteriaNombre}
          rol={session.user.rol}
          soporte={session.user.soporte}
          isSuperAdmin={session.user.isSuperAdmin}
        />
        {diasParaVencer !== null && diasParaVencer <= 3 && vigenciaHasta && (
          <AvisoVigencia diasParaVencer={diasParaVencer} vigenciaHastaTexto={formatearFecha(vigenciaHasta)} />
        )}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-8">{children}</main>
      </SidebarMarginAdjuster>
    </div>
  );
}
