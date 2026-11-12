import { redirect } from "next/navigation";
import { obtenerAccesoFerreteria, obtenerSesionValidada } from "@/lib/tenant";
import { diasHastaUruguay, formatearFecha } from "@/lib/fecha";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SidebarMarginAdjuster } from "./sidebar-margin-adjuster";
import { AvisoVigencia } from "./aviso-vigencia";
import { AccesoInhabilitado } from "./acceso-inhabilitado";
import { AvisoAccesoInhabilitadoAdmin } from "./aviso-acceso-inhabilitado-admin";

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

  // Estado de acceso de la ferretería (una consulta por request, compartida
  // con la autorización de las APIs). Si el administrador de la plataforma
  // la inhabilitó por falta de pago, TODO el equipo ve solo el mensaje de
  // cuota vencida — sin menú ni pantallas. El Super Admin sí entra (modo
  // soporte) y ve un cartel que le recuerda que está inhabilitada.
  const acceso = session.user.ferreteriaId ? await obtenerAccesoFerreteria(session.user.ferreteriaId) : null;
  if (acceso?.inhabilitada && !session.user.isSuperAdmin) {
    return (
      <AccesoInhabilitado
        ferreteriaNombre={session.user.ferreteriaNombre ?? "tu ferretería"}
        vencioTexto={acceso.vigenciaHasta ? formatearFecha(acceso.vigenciaHasta) : null}
        email={session.user.email ?? ""}
      />
    );
  }

  // Aviso de vencimiento de la mensualidad de la plataforma: solo al
  // Dueño (es quien paga), no a Cajero/Depósito. También lo ve el Super
  // Admin en modo soporte (que entra con el rol Dueño prestado), para ver lo
  // mismo que ve la ferretería. 3 días de antelación o menos, incluyendo si
  // ya venció.
  let diasParaVencer: number | null = null;
  let vigenciaHasta: Date | null = null;
  if (session.user.rol === "DUENO" && acceso?.vigenciaHasta) {
    vigenciaHasta = acceso.vigenciaHasta;
    diasParaVencer = diasHastaUruguay(acceso.vigenciaHasta);
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
        {acceso?.inhabilitada && session.user.isSuperAdmin && <AvisoAccesoInhabilitadoAdmin />}
        {diasParaVencer !== null && diasParaVencer <= 3 && vigenciaHasta && (
          <AvisoVigencia diasParaVencer={diasParaVencer} vigenciaHastaTexto={formatearFecha(vigenciaHasta)} />
        )}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-8">{children}</main>
      </SidebarMarginAdjuster>
    </div>
  );
}
