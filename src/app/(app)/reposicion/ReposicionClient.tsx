"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

type Sugerencia = {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  stockMinimo: number;
  ventaPromedioDiaria: number;
  diasRestantes: number | null;
  cantidadSugerida: number;
};

export function ReposicionClient({ sugerencias }: { sugerencias: Sugerencia[] }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reposición sugerida"
        description="Productos que conviene reponer ya, calculado por debajo del mínimo o por ritmo de venta de los últimos 30 días."
      />

      <DataTable
        data={sugerencias}
        rowKey={(s) => s.id}
        searchValue={(s) => `${s.codigo} ${s.descripcion}`}
        searchPlaceholder="Buscar producto…"
        emptyMessage="No hay productos que necesiten reposición ahora mismo."
        pageSize={20}
        columns={[
          {
            key: "producto", header: "Producto", sortValue: (s) => s.descripcion,
            render: (s) => (
              <div>
                <div className="font-medium text-foreground">{s.descripcion}</div>
                <div className="text-xs text-muted-foreground">{s.codigo}</div>
              </div>
            ),
          },
          {
            key: "stock", header: "Stock", sortValue: (s) => s.stockActual,
            render: (s) => (
              <span className={s.stockActual <= s.stockMinimo ? "font-medium text-danger" : "text-foreground"}>
                {s.stockActual} (mín. {s.stockMinimo})
              </span>
            ),
          },
          {
            key: "venta", header: "Venta prom./día (30d)", sortValue: (s) => s.ventaPromedioDiaria,
            render: (s) => s.ventaPromedioDiaria.toFixed(2),
          },
          {
            key: "dias", header: "Días restantes", sortValue: (s) => s.diasRestantes ?? -1,
            render: (s) => (
              s.diasRestantes === null
                ? <Badge variant="danger">Sin ventas recientes</Badge>
                : <Badge variant={s.diasRestantes <= 7 ? "danger" : "warning"}>{Math.floor(s.diasRestantes)} días</Badge>
            ),
          },
          {
            key: "sugerida", header: "Cantidad sugerida", sortValue: (s) => s.cantidadSugerida, className: "font-mono tabular-nums font-semibold",
            render: (s) => s.cantidadSugerida,
          },
          {
            key: "acciones", header: "", headClassName: "w-0",
            render: () => <a href="/compras/nuevo" className="text-sm text-primary underline underline-offset-2">Comprar</a>,
          },
        ]}
      />
    </div>
  );
}
