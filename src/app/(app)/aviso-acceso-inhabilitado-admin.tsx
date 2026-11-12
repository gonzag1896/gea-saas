import { ShieldAlert } from "lucide-react";

// Cartel para el Super Admin cuando mira (modo soporte) una ferretería cuyo
// acceso está inhabilitado: sus usuarios no pueden entrar y ven el mensaje de
// cuota vencida. Se vuelve a habilitar desde /admin/ferreterias.
export function AvisoAccesoInhabilitadoAdmin() {
  return (
    <div role="status" className="flex items-center gap-3 border-b-4 border-red-950/40 bg-red-900 px-6 py-2.5 text-white">
      <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="text-sm font-semibold">
        Esta ferretería tiene el ACCESO INHABILITADO: sus usuarios no pueden entrar y ven el mensaje de cuota vencida. Se vuelve a habilitar desde el panel de administración.
      </p>
    </div>
  );
}
