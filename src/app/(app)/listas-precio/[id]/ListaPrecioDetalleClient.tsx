"use client";

import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

type Fila = { id: string; codigo: string; producto: string; familia: string; categoria: string; precio: string };
type Lista = { id: string; nombre: string };

export function ListaPrecioDetalleClient({ lista, filas }: { lista: Lista; filas: Fila[] }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lista.nombre}
        description={`${filas.length} producto${filas.length === 1 ? "" : "s"} con precio cargado en esta lista.`}
        action={
          <Button variant="outline" onClick={() => window.open(`/api/reportes/lista-precio/${lista.id}`, "_blank")}>
            <FileText className="h-4 w-4" /> Exportar PDF
          </Button>
        }
      />

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Código</Table.HeadCell>
            <Table.HeadCell>Producto</Table.HeadCell>
            <Table.HeadCell>Familia / Categoría</Table.HeadCell>
            <Table.HeadCell>Precio</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <tbody>
          {filas.map((f) => (
            <Table.Row key={f.id}>
              <Table.Cell>{f.codigo}</Table.Cell>
              <Table.Cell>{f.producto}</Table.Cell>
              <Table.Cell>
                <div className="text-foreground">{f.familia}</div>
                <div className="text-xs text-muted-foreground">{f.categoria}</div>
              </Table.Cell>
              <Table.Cell className="font-mono tabular-nums">$ {Number(f.precio).toFixed(2)}</Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {filas.length === 0 && (
        <EmptyState message="Esta lista todavía no tiene precios cargados. Se cargan desde la ficha de cada producto." />
      )}
    </div>
  );
}
