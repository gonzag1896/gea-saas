"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";
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
type Venta = {
  id: string;
  fecha: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  medioPago: string;
  total: string;
  cliente: { nombre: string };
};
type Linea = { productoId: string; cantidad: string; precio: string; descuento: string };

export default function VentasPage() {
  const { data: session } = useSession();
  const puedeCrear = !!session?.user.rol && tienePermiso(session.user.rol, "ventas", "crear");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<Opcion[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPago, setMedioPago] = useState<"CONTADO" | "CREDITO" | "TRANSFERENCIA">("CONTADO");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({ productoId: "", cantidad: "1", precio: "", descuento: "0" });
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resVentas, resCli, resProd] = await Promise.all([
      fetch("/api/ventas"),
      fetch("/api/clientes"),
      fetch("/api/productos"),
    ]);
    if (resVentas.ok) setVentas((await resVentas.json()).ventas);
    if (resCli.ok) {
      const clis = (await resCli.json()).clientes;
      setClientes(clis);
      setClienteId((actual) => actual || clis[0]?.id || "");
    }
    if (resProd.ok) {
      const prods = (await resProd.json()).productos;
      setProductos(prods);
      setLineaActual((l) => ({ ...l, productoId: l.productoId || prods[0]?.id || "" }));
    }
  }
  useEffect(() => { cargar(); }, []);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.precio) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", precio: "", descuento: "0" });
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  async function crearVenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos una línea.");

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        fecha: new Date(fecha).toISOString(),
        medioPago,
        detalle: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad), precio: Number(l.precio), descuento: Number(l.descuento) })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setLineas([]);
    cargar();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Ventas" />

      {puedeCrear && clientes.length > 0 && productos.length > 0 && (
        <Card className="max-w-2xl">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Nueva venta</h3>
          <form onSubmit={crearVenta} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="max-w-[220px]">
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="max-w-[170px]" />
              <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as typeof medioPago)} className="max-w-[160px]">
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={lineaActual.productoId} onChange={(e) => setLineaActual({ ...lineaActual, productoId: e.target.value })} className="max-w-[220px]">
                {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>)}
              </Select>
              <Input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} placeholder="Cantidad" className="max-w-[100px]" />
              <Input type="number" step="0.01" value={lineaActual.precio} onChange={(e) => setLineaActual({ ...lineaActual, precio: e.target.value })} placeholder="Precio" className="max-w-[120px]" />
              <Input type="number" step="0.01" value={lineaActual.descuento} onChange={(e) => setLineaActual({ ...lineaActual, descuento: e.target.value })} placeholder="Descuento" className="max-w-[120px]" />
              <Button type="button" variant="secondary" onClick={agregarLinea}>+ Línea</Button>
            </div>

            {lineas.length > 0 && (
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Producto</Table.HeadCell>
                    <Table.HeadCell>Cant.</Table.HeadCell>
                    <Table.HeadCell>Precio</Table.HeadCell>
                    <Table.HeadCell>Desc.</Table.HeadCell>
                    <Table.HeadCell />
                  </Table.Row>
                </Table.Head>
                <tbody>
                  {lineas.map((l, i) => (
                    <Table.Row key={i}>
                      <Table.Cell>{nombreProducto(l.productoId)}</Table.Cell>
                      <Table.Cell>{l.cantidad}</Table.Cell>
                      <Table.Cell>{l.precio}</Table.Cell>
                      <Table.Cell>{l.descuento}</Table.Cell>
                      <Table.Cell><Button type="button" variant="ghost" size="sm" onClick={() => quitarLinea(i)}>Quitar</Button></Table.Cell>
                    </Table.Row>
                  ))}
                </tbody>
              </Table>
            )}

            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit">Registrar venta</Button>
            </div>
          </form>
        </Card>
      )}

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Fecha</Table.HeadCell>
            <Table.HeadCell>Cliente</Table.HeadCell>
            <Table.HeadCell>Medio de pago</Table.HeadCell>
            <Table.HeadCell>Total</Table.HeadCell>
            <Table.HeadCell>Estado</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {ventas.map((v) => (
            <Table.Row key={v.id}>
              <Table.Cell>{new Date(v.fecha).toLocaleDateString("es-UY")}</Table.Cell>
              <Table.Cell>{v.cliente.nombre}</Table.Cell>
              <Table.Cell>{v.medioPago}</Table.Cell>
              <Table.Cell>{v.total}</Table.Cell>
              <Table.Cell><EstadoBadge estado={v.estado} /></Table.Cell>
              <Table.Cell><a href={`/ventas/${v.id}`} className="text-sm text-primary underline underline-offset-2">Ver</a></Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {ventas.length === 0 && <EmptyState message="Todavía no hay ventas registradas." />}
    </main>
  );
}
