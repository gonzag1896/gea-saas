import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

// Aviso de vencimiento de la mensualidad — visible solo al Dueño (ver
// layout.tsx), en cualquier pantalla, los últimos 3 días antes de que
// venza la vigencia o ya vencida.
export function AvisoVigencia({
  diasParaVencer,
  vigenciaHastaTexto,
}: {
  diasParaVencer: number;
  vigenciaHastaTexto: string;
}) {
  const vencida = diasParaVencer < 0;

  const mensaje = vencida
    ? `Tu plataforma venció el ${vigenciaHastaTexto}. Contactanos para renovarla.`
    : diasParaVencer === 0
      ? `Tu plataforma vence hoy (${vigenciaHastaTexto}). Contactanos para renovarla.`
      : `Tu plataforma vence en ${diasParaVencer} día${diasParaVencer === 1 ? "" : "s"} (${vigenciaHastaTexto}). Contactanos para renovarla.`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-6 py-2.5 text-sm font-medium",
        vencida ? "border-danger/20 bg-danger/10 text-danger" : "border-warning/20 bg-warning/10 text-warning",
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {mensaje}
    </div>
  );
}
