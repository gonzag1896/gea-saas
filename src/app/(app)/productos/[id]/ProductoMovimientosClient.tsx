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
import { EmptyState } from "@/components/ui/EmptyState";

type Producto = { id: string; codigo: string; descripcion: string; stockActual: number; stockMinimo: number };
type Movimiento = {
  id: string;
  fecha: Date;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  cantidad: number;
  motivo: string | null;
  origenTipo: string;
};

const ETIQUETA_TIPO: Record<Movimiento["tipo"], string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

export function ProductoMovimientosClient({
  producto,
  movimientosIniciales,
  puedeAjustar,
}: {
  producto: Producto;
  movimientosIniciales: Movimiento[];
  puedeAjustar: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO">("AJUSTE_POSITIVO");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function registrarAjuste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/productos/${producto.id}/ajuste-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, cantidad: Number(cantidad), motivo }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${producto.codigo} — ${producto.descripcion}`}
        description={`Stock actual: ${producto.stockActual} (mínimo: ${producto.stockMinimo})`}
      />

      {puedeAjustar && (
        <Card className="max-w-lg">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Ajustar stock</h3>
          <form onSubmit={registrarAjuste} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="max-w-[200px]">
                <option value="AJUSTE_POSITIVO">Ajuste positivo</option>
                <option value="AJUSTE_NEGATIVO">Ajuste negativo</option>
              </Select>
              <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" className="max-w-[120px]" />
            </div>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ej: diferencia de inventario)" required />
            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit">Registrar ajuste</Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de movimientos</h3>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Fecha</Table.HeadCell>
              <Table.HeadCell>Tipo</Table.HeadCell>
              <Table.HeadCell>Cantidad</Table.HeadCell>
              <Table.HeadCell>Origen</Table.HeadCell>
              <Table.HeadCell>Motivo</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <tbody>
            {movimientosIniciales.map((m) => (
              <Table.Row key={m.id}>
                <Table.Cell>{new Date(m.fecha).toLocaleDateString("es-UY")}</Table.Cell>
                <Table.Cell>{ETIQUETA_TIPO[m.tipo]}</Table.Cell>
                <Table.Cell>{m.cantidad}</Table.Cell>
                <Table.Cell>{m.origenTipo}</Table.Cell>
                <Table.Cell>{m.motivo ?? "—"}</Table.Cell>
              </Table.Row>
            ))}
          </tbody>
        </Table>
        {movimientosIniciales.length === 0 && <EmptyState message="Todavía no hay movimientos para este producto." />}
      </div>
    </div>
  );
}
