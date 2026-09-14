"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { EstadoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Opcion = { id: string; nombre?: string; codigo?: string; descripcion?: string };
type Compra = {
  id: string;
  fecha: Date;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  total: string;
  proveedor: { nombre: string };
};
type Linea = { productoId: string; cantidad: string; costoUnitario: string; tipoIva: "EXENTO" | "TOTAL" };

export function ComprasClient({
  comprasIniciales,
  proveedores,
  productos,
  puedeCrear,
}: {
  comprasIniciales: Compra[];
  proveedores: Opcion[];
  productos: Opcion[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [numeroFactura, setNumeroFactura] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({ productoId: productos[0]?.id ?? "", cantidad: "1", costoUnitario: "", tipoIva: "EXENTO" });
  const [error, setError] = useState<string | null>(null);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.costoUnitario) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", costoUnitario: "" });
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  async function crearCompra(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos una línea.");

    const res = await fetch("/api/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorId,
        fecha: new Date(fecha).toISOString(),
        numeroFactura: numeroFactura || undefined,
        detalle: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad), costoUnitario: Number(l.costoUnitario), tipoIva: l.tipoIva })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setLineas([]);
    setNumeroFactura("");
    router.refresh();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Compras" />

      {puedeCrear && proveedores.length > 0 && productos.length > 0 && (
        <Card className="max-w-2xl">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Nueva compra</h3>
          <form onSubmit={crearCompra} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="max-w-[220px]">
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="max-w-[170px]" />
              <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="N° Factura" className="max-w-[160px]" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={lineaActual.productoId} onChange={(e) => setLineaActual({ ...lineaActual, productoId: e.target.value })} className="max-w-[220px]">
                {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>)}
              </Select>
              <Input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} placeholder="Cantidad" className="max-w-[100px]" />
              <Input type="number" step="0.01" value={lineaActual.costoUnitario} onChange={(e) => setLineaActual({ ...lineaActual, costoUnitario: e.target.value })} placeholder="Costo unitario" className="max-w-[140px]" />
              <Select value={lineaActual.tipoIva} onChange={(e) => setLineaActual({ ...lineaActual, tipoIva: e.target.value as "EXENTO" | "TOTAL" })} className="max-w-[140px]">
                <option value="EXENTO">Exento</option>
                <option value="TOTAL">IVA 22%</option>
              </Select>
              <Button type="button" variant="secondary" onClick={agregarLinea}>+ Línea</Button>
            </div>

            {lineas.length > 0 && (
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Producto</Table.HeadCell>
                    <Table.HeadCell>Cant.</Table.HeadCell>
                    <Table.HeadCell>Costo</Table.HeadCell>
                    <Table.HeadCell>IVA</Table.HeadCell>
                    <Table.HeadCell />
                  </Table.Row>
                </Table.Head>
                <tbody>
                  {lineas.map((l, i) => (
                    <Table.Row key={i}>
                      <Table.Cell>{nombreProducto(l.productoId)}</Table.Cell>
                      <Table.Cell>{l.cantidad}</Table.Cell>
                      <Table.Cell>{l.costoUnitario}</Table.Cell>
                      <Table.Cell>{l.tipoIva === "TOTAL" ? "22%" : "Exento"}</Table.Cell>
                      <Table.Cell><Button type="button" variant="ghost" size="sm" onClick={() => quitarLinea(i)}>Quitar</Button></Table.Cell>
                    </Table.Row>
                  ))}
                </tbody>
              </Table>
            )}

            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit">Registrar compra</Button>
            </div>
          </form>
        </Card>
      )}

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Fecha</Table.HeadCell>
            <Table.HeadCell>Proveedor</Table.HeadCell>
            <Table.HeadCell>Total</Table.HeadCell>
            <Table.HeadCell>Estado</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {comprasIniciales.map((c) => (
            <Table.Row key={c.id}>
              <Table.Cell>{new Date(c.fecha).toLocaleDateString("es-UY")}</Table.Cell>
              <Table.Cell>{c.proveedor.nombre}</Table.Cell>
              <Table.Cell className="font-mono tabular-nums">{c.total}</Table.Cell>
              <Table.Cell><EstadoBadge estado={c.estado} /></Table.Cell>
              <Table.Cell><a href={`/compras/${c.id}`} className="text-sm text-primary underline underline-offset-2">Ver</a></Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {comprasIniciales.length === 0 && <EmptyState message="Todavía no hay compras registradas." />}
    </div>
  );
}
