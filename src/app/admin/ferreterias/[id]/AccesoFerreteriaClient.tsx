"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";

// Botón para inhabilitar / volver a habilitar el acceso de TODA la ferretería.
// Inhabilitada: sus usuarios no pueden usar el sistema y ven un mensaje de
// cuota vencida. No se borra ningún dato; se revierte con un clic.
export function AccesoFerreteriaClient({
  ferreteriaId,
  nombre,
  inhabilitada,
  pagoVigente,
}: {
  ferreteriaId: string;
  nombre: string;
  inhabilitada: boolean;
  // La ferretería tiene una mensualidad vigente (no vencida) cargada.
  pagoVigente: boolean;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ferreterias/${ferreteriaId}/acceso`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habilitado: inhabilitada }), // si está inhabilitada -> habilitar, y al revés
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "No se pudo cambiar el acceso.");
        return;
      }
      setConfirmando(false);
      router.refresh();
    } catch {
      setError("No se pudo cambiar el acceso. Revisá la conexión y probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={cn("rounded-xl border p-5", inhabilitada ? "border-danger/30 bg-danger/5" : "border-border bg-surface shadow-card")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", inhabilitada ? "bg-danger/15 text-danger" : "bg-success/15 text-success")}>
            {inhabilitada ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Acceso a la plataforma</p>
            <p className={cn("text-sm font-medium", inhabilitada ? "text-danger" : "text-success")}>
              {inhabilitada ? "Acceso inhabilitado: ven el mensaje de cuota vencida" : "Acceso habilitado"}
            </p>
          </div>
        </div>

        <Button type="button" variant={inhabilitada ? "success" : "danger"} onClick={() => setConfirmando(true)}>
          {inhabilitada ? "Habilitar acceso" : "Inhabilitar acceso"}
        </Button>
      </div>

      {inhabilitada && pagoVigente && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ojo: esta ferretería tiene una mensualidad vigente cargada, pero el acceso sigue inhabilitado hasta que lo habilites.
        </p>
      )}
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}

      <ConfirmDialog
        open={confirmando}
        title={inhabilitada ? "Habilitar acceso" : "Inhabilitar acceso"}
        message={
          inhabilitada
            ? `¿Volver a habilitar el acceso de "${nombre}"? Sus usuarios van a poder usar el sistema de nuevo.`
            : `¿Inhabilitar el acceso de "${nombre}"? Todos sus usuarios dejan de poder usar el sistema y ven un mensaje de cuota vencida. No se borra ningún dato y lo podés volver a habilitar cuando quieras.`
        }
        confirmLabel={inhabilitada ? "Habilitar acceso" : "Inhabilitar acceso"}
        variant={inhabilitada ? "primary" : "danger"}
        loading={cargando}
        onConfirm={cambiar}
        onCancel={() => { setConfirmando(false); setError(null); }}
      />
    </div>
  );
}
