import { ShieldAlert, LogOut } from "lucide-react";
import { textoAccesoInhabilitado } from "@/lib/vigencia";
import { cerrarSesion } from "./actions";

// Pantalla completa que reemplaza a toda la aplicación cuando el administrador
// de la plataforma inhabilitó el acceso de la ferretería (cuota vencida).
// No hay sidebar ni navegación: no se puede usar nada hasta que se regularice.
export function AccesoInhabilitado({
  ferreteriaNombre,
  vencioTexto,
  email,
}: {
  ferreteriaNombre: string;
  vencioTexto: string | null;
  email: string;
}) {
  const { titulo, subtitulo, detalle, accion } = textoAccesoInhabilitado(vencioTexto, ferreteriaNombre);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-lg">
        <div className="flex items-center gap-4 bg-danger px-8 py-6 text-white">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/90">{subtitulo}</p>
            <h1 className="text-2xl font-bold">{titulo}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-8 py-7">
          <p className="text-lg font-semibold text-foreground">{detalle}</p>
          <p className="text-base text-muted-foreground">{accion}</p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">Sesión iniciada como {email}</p>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
