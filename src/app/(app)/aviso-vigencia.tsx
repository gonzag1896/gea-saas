import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { textoAvisoVigencia } from "@/lib/vigencia";

// Aviso de vencimiento de la mensualidad — se muestra al Dueño (y a Soporte
// cuando mira esa ferretería, ver layout.tsx), en cualquier pantalla, los
// últimos 3 días antes de que venza la vigencia o ya vencida. Es a propósito
// llamativo: franja de color pleno, texto grande y blanco, para que no pase
// desapercibido. No bloquea nada, solo se hace imposible de ignorar.
export function AvisoVigencia({
  diasParaVencer,
  vigenciaHastaTexto,
}: {
  diasParaVencer: number;
  vigenciaHastaTexto: string;
}) {
  const { vencida, titulo, detalle } = textoAvisoVigencia(diasParaVencer, vigenciaHastaTexto);

  return (
    <div
      role={vencida ? "alert" : "status"}
      className={cn(
        "flex items-center gap-4 px-6 py-3.5 text-white shadow-sm",
        vencida ? "border-b-4 border-red-900/40 bg-danger" : "border-b-4 border-amber-900/30 bg-warning",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold uppercase tracking-wide">{titulo}</p>
        <p className="text-sm font-medium text-white/95">{detalle}</p>
      </div>
    </div>
  );
}
