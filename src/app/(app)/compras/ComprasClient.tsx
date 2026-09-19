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

type Compra = {
  id: string;
  fecha: Date;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  total: string;
  proveedor: { nombre: string };
};

export function ComprasClient({
  comprasIniciales,
  puedeCrear,
  puedeAnular,
}: {
  comprasIniciales: Compra[];
  puedeCrear: boolean;
  puedeAnular: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<Compra | null>(null);
  const [anulando, setAnulando] = useState(false);

  async function confirmarAnular(motivo: string) {
    if (!aAnular) return;
    setError(null);
    setAnulando(true);
    const res = await fetch(`/api/compras/${aAnular.id}/anular`, {
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
        title="Compras"
        action={(
          <div className="flex items-center gap-2">
            <ExportarButton reporte="compras" />
            {puedeCrear && (
              <Button onClick={() => router.push("/compras/nuevo")}>
                <Plus className="h-4 w-4" /> Nueva compra
              </Button>
            )}
          </div>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={comprasIniciales}
        rowKey={(c) => c.id}
        searchValue={(c) => c.proveedor.nombre}
        searchPlaceholder="Buscar por proveedor…"
        emptyMessage="Todavía no hay compras registradas."
        columns={[
          { key: "fecha", header: "Fecha", sortValue: (c) => new Date(c.fecha).getTime(), render: (c) => new Date(c.fecha).toLocaleDateString("es-UY") },
          { key: "proveedor", header: "Proveedor", sortValue: (c) => c.proveedor.nombre, render: (c) => c.proveedor.nombre },
          { key: "total", header: "Total", sortValue: (c) => Number(c.total), className: "font-mono tabular-nums", render: (c) => c.total },
          { key: "estado", header: "Estado", sortValue: (c) => c.estado, render: (c) => <EstadoBadge estado={c.estado} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (c) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="icon" className="h-8 w-8" aria-label="Ver compra" onClick={() => router.push(`/compras/${c.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {puedeAnular && c.estado !== "ANULADO" && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label="Anular compra" onClick={() => setAAnular(c)}>
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
        title="Anular compra"
        label="Motivo de la anulación"
        loading={anulando}
        onConfirm={confirmarAnular}
        onCancel={() => setAAnular(null)}
      />
    </div>
  );
}
