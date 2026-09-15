"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";

type ClienteConSaldo = { id: string; nombre: string; telefono: string | null; saldo: number };

export function CuentaCorrienteClient({ clientes }: { clientes: ClienteConSaldo[] }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cuenta Corriente" />
      <DataTable
        data={clientes}
        rowKey={(c) => c.id}
        searchValue={(c) => `${c.nombre} ${c.telefono ?? ""}`}
        searchPlaceholder="Buscar cliente…"
        emptyMessage="Todavía no hay clientes cargados."
        columns={[
          { key: "nombre", header: "Cliente", sortValue: (c) => c.nombre, render: (c) => c.nombre },
          { key: "telefono", header: "Teléfono", render: (c) => c.telefono ?? "—" },
          {
            key: "saldo", header: "Saldo", sortValue: (c) => c.saldo, className: "font-mono tabular-nums",
            render: (c) => <span className={cn(c.saldo > 0 && "text-danger font-medium")}>{c.saldo.toFixed(2)}</span>,
          },
          { key: "acciones", header: "", render: (c) => <a href={`/clientes/${c.id}`} className="text-sm text-primary underline underline-offset-2">Ver detalle</a> },
        ]}
      />
    </div>
  );
}
