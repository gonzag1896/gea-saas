"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Ban } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { EstadoBadge } from "@/components/ui/Badge";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { ExportarButton } from "@/components/ui/ExportarButton";

type Venta = {
  id: string;
  fecha: Date;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  medioPago: string;
  total: string;
  cliente: { nombre: string };
};

export function VentasClient({
  ventasIniciales,
  puedeCrear,
  puedeAnular,
}: {
  ventasIniciales: Venta[];
  puedeCrear: boolean;
  puedeAnular: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<Venta | null>(null);
  const [anulando, setAnulando] = useState(false);

  async function confirmarAnular(motivo: string) {
    if (!aAnular) return;
    setError(null);
    setAnulando(true);
    const res = await fetch(`/api/ventas/${aAnular.id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setAnulando(false);
    if (!res.ok) {
      setError((await res.json()).error);
      setAAnular(null);
      return;
    }
    setAAnular(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ventas"
        action={(
          <div className="flex items-center gap-2">
            <ExportarButton reporte="ventas" />
            {puedeCrear && (
              <Button onClick={() => router.push("/ventas/nuevo")}>
                <Plus className="h-4 w-4" /> Nueva venta
              </Button>
            )}
          </div>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={ventasIniciales}
        rowKey={(v) => v.id}
        searchValue={(v) => `${v.cliente.nombre} ${v.medioPago}`}
        searchPlaceholder="Buscar por cliente…"
        emptyMessage="Todavía no hay ventas registradas."
        columns={[
          { key: "fecha", header: "Fecha", sortValue: (v) => new Date(v.fecha).getTime(), render: (v) => new Date(v.fecha).toLocaleDateString("es-UY") },
          { key: "cliente", header: "Cliente", sortValue: (v) => v.cliente.nombre, render: (v) => v.cliente.nombre },
          { key: "medioPago", header: "Medio de pago", sortValue: (v) => v.medioPago, render: (v) => v.medioPago },
          { key: "total", header: "Total", sortValue: (v) => Number(v.total), className: "font-mono tabular-nums", render: (v) => v.total },
          { key: "estado", header: "Estado", sortValue: (v) => v.estado, render: (v) => <EstadoBadge estado={v.estado} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (v) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="icon" className="h-8 w-8" aria-label="Ver venta" onClick={() => router.push(`/ventas/${v.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {puedeAnular && v.estado !== "ANULADO" && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label="Anular venta" onClick={() => setAAnular(v)}>
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <PromptDialog
        open={aAnular !== null}
        title="Anular venta"
        label="Motivo de la anulación"
        loading={anulando}
        onConfirm={confirmarAnular}
        onCancel={() => setAAnular(null)}
      />
    </div>
  );
}
