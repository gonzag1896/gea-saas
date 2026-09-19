"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ShoppingCart, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type Esperado = { totalVentasContado: number; totalCobrosContado: number; totalEsperado: number };
type Cierre = {
  id: string;
  fecha: string;
  totalVentasContado: number;
  totalCobrosContado: number;
  totalEsperado: number;
  totalContado: number;
  diferencia: number;
  observaciones: string | null;
};

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CajaClient({
  esperado,
  yaCerradaHoy,
  cierres,
  puedeCerrar,
}: {
  esperado: Esperado;
  yaCerradaHoy: boolean;
  cierres: Cierre[];
  puedeCerrar: boolean;
}) {
  const router = useRouter();
  const [totalContado, setTotalContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cierreHoy, setCierreHoy] = useState<{ diferencia: number; totalContado: number } | null>(null);

  const diferenciaPreview = totalContado ? Number(totalContado) - esperado.totalEsperado : null;

  async function cerrarCaja(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/caja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: new Date().toISOString(),
        totalContado: Number(totalContado),
        observaciones: observaciones || undefined,
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setCierreHoy({ diferencia: Number(data.cierre.diferencia), totalContado: Number(data.cierre.totalContado) });
    router.refresh();
  }

  const yaCerrada = yaCerradaHoy || cierreHoy !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Caja" description="Cierre diario: lo que el sistema espera contra lo que hay físicamente." />

      <div className="flex flex-wrap gap-4">
        <Card className="flex min-w-[220px] flex-1 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ventas Contado de hoy</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">$ {formatoMoneda(esperado.totalVentasContado)}</div>
          </div>
        </Card>
        <Card className="flex min-w-[220px] flex-1 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Cobros Contado de hoy</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">$ {formatoMoneda(esperado.totalCobrosContado)}</div>
          </div>
        </Card>
        <Card className="flex min-w-[220px] flex-1 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total esperado en caja</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">$ {formatoMoneda(esperado.totalEsperado)}</div>
          </div>
        </Card>
      </div>

      {puedeCerrar && !yaCerrada && (
        <Card className="max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Cerrar caja de hoy</h3>
          <form onSubmit={cerrarCaja} className="flex flex-col gap-3">
            <FormField label="Monto contado físicamente" required>
              <Input type="number" step="0.01" min="0" value={totalContado} onChange={(e) => setTotalContado(e.target.value)} placeholder="$" required />
            </FormField>
            {diferenciaPreview !== null && (
              <p className={cn("text-sm font-medium", diferenciaPreview === 0 ? "text-success" : "text-danger")}>
                {diferenciaPreview === 0
                  ? "Cuadra exacto."
                  : diferenciaPreview > 0
                    ? `Sobran $ ${formatoMoneda(diferenciaPreview)} respecto a lo esperado.`
                    : `Faltan $ ${formatoMoneda(Math.abs(diferenciaPreview))} respecto a lo esperado.`}
              </p>
            )}
            <FormField label="Observaciones">
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" />
            </FormField>
            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit" loading={guardando}>Cerrar caja</Button>
            </div>
          </form>
        </Card>
      )}

      {yaCerrada && !cierreHoy && (
        <Alert variant="info">La caja de hoy ya fue cerrada. Mirá el detalle en el historial.</Alert>
      )}
      {cierreHoy && (
        <Alert variant={cierreHoy.diferencia === 0 ? "success" : "error"}>
          Caja cerrada — contado $ {formatoMoneda(cierreHoy.totalContado)}, diferencia $ {formatoMoneda(cierreHoy.diferencia)}.
        </Alert>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de cierres</h3>
        <DataTable
          data={cierres}
          rowKey={(c) => c.id}
          emptyMessage="Todavía no se cerró la caja ningún día."
          pageSize={15}
          columns={[
            { key: "fecha", header: "Fecha", sortValue: (c) => c.fecha, render: (c) => new Date(c.fecha).toLocaleDateString("es-UY") },
            { key: "esperado", header: "Esperado", className: "font-mono tabular-nums", render: (c) => `$ ${formatoMoneda(c.totalEsperado)}` },
            { key: "contado", header: "Contado", className: "font-mono tabular-nums", render: (c) => `$ ${formatoMoneda(c.totalContado)}` },
            {
              key: "diferencia", header: "Diferencia", className: "font-mono tabular-nums",
              render: (c) => (
                <Badge variant={c.diferencia === 0 ? "success" : "danger"}>
                  {c.diferencia >= 0 ? "+" : ""}{formatoMoneda(c.diferencia)}
                </Badge>
              ),
            },
            { key: "observaciones", header: "Observaciones", render: (c) => c.observaciones ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
