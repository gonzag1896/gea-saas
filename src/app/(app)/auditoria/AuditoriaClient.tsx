"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";

type Evento = { id: string; fecha: string; accion: string; usuario: string; entidad: string };

export function AuditoriaClient({ eventos }: { eventos: Evento[] }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Auditoría" description="Últimos 50 eventos de esta ferretería." />
      <DataTable
        data={eventos}
        rowKey={(e) => e.id}
        searchValue={(e) => `${e.accion} ${e.usuario} ${e.entidad}`}
        searchPlaceholder="Buscar por acción, usuario o entidad…"
        emptyMessage="Todavía no hay eventos registrados."
        columns={[
          { key: "fecha", header: "Fecha", render: (e) => e.fecha },
          { key: "accion", header: "Acción", sortValue: (e) => e.accion, render: (e) => e.accion },
          { key: "usuario", header: "Usuario", sortValue: (e) => e.usuario, render: (e) => e.usuario },
          { key: "entidad", header: "Entidad", sortValue: (e) => e.entidad, render: (e) => e.entidad },
        ]}
      />
    </div>
  );
}
