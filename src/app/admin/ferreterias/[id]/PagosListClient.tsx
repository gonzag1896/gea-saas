"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, ArrowRight, Pencil } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFecha } from "@/lib/fecha";

export type PagoFila = {
  id: string;
  fecha: string; // ISO
  monto: string | null;
  esGratis: boolean;
  vigenciaDesde: string; // ISO
  vigenciaHasta: string; // ISO
  registradoPorNombre: string | null;
};

function aInputDate(iso: string): string {
  return iso.slice(0, 10);
}

function FilaEdicion({ ferreteriaId, pago, onCancelar, onGuardado }: {
  ferreteriaId: string; pago: PagoFila; onCancelar: () => void; onGuardado: () => void;
}) {
  const [fecha, setFecha] = useState(aInputDate(pago.fecha));
  const [monto, setMonto] = useState(pago.monto ?? "");
  const [esGratis, setEsGratis] = useState(pago.esGratis);
  const [vigenciaHasta, setVigenciaHasta] = useState(aInputDate(pago.vigenciaHasta));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/admin/ferreterias/${ferreteriaId}/pagos/${pago.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha,
        monto: !esGratis && monto ? Number(monto) : undefined,
        esGratis,
        vigenciaHasta,
      }),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    onGuardado();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap gap-3">
        <FormField label="Fecha del pago" required>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </FormField>
        <FormField label="Monto">
          <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} disabled={esGratis} />
        </FormField>
        <FormField label="Vigencia hasta" required>
          <Input type="date" value={vigenciaHasta} onChange={(e) => setVigenciaHasta(e.target.value)} required />
        </FormField>
      </div>
      <Checkbox id={`gratis-${pago.id}`} label="Mes gratis / cortesía" checked={esGratis} onChange={(e) => setEsGratis(e.target.checked)} />
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={guardando}>Guardar</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  );
}

export function PagosListClient({ ferreteriaId, pagos }: { ferreteriaId: string; pagos: PagoFila[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);

  if (pagos.length === 0) return <EmptyState message="Sin pagos registrados todavía." />;

  return (
    <div className="flex flex-col gap-2">
      {pagos.map((p) =>
        editando === p.id ? (
          <FilaEdicion
            key={p.id}
            ferreteriaId={ferreteriaId}
            pago={p}
            onCancelar={() => setEditando(null)}
            onGuardado={() => { setEditando(null); router.refresh(); }}
          />
        ) : (
          <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{formatearFecha(p.fecha)}</p>
                {p.esGratis && <Badge variant="warning">Gratis</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{p.registradoPorNombre ?? "—"}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{formatearFecha(p.vigenciaDesde)}</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{formatearFecha(p.vigenciaHasta)}</span>
            </div>
            <p className="w-16 shrink-0 text-right font-semibold text-foreground">{p.esGratis ? "—" : (p.monto ?? "—")}</p>
            <button
              type="button"
              onClick={() => setEditando(p.id)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Editar pago"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ),
      )}
    </div>
  );
}
