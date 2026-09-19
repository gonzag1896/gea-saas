"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ExportarButton } from "@/components/ui/ExportarButton";

type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";

type Movimiento = {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  origenTipo: string;
  productoCodigo: string;
  productoDescripcion: string;
  usuario: string;
};

const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

const VARIANTE_TIPO: Record<TipoMovimiento, BadgeVariant> = {
  ENTRADA: "success",
  SALIDA: "danger",
  AJUSTE_POSITIVO: "success",
  AJUSTE_NEGATIVO: "warning",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE: "Ajuste manual",
  DEVOLUCION_COMPRA: "Devolución de compra",
  DEVOLUCION_VENTA: "Devolución de venta",
};

export function MovimientoStockClient({ movimientos }: { movimientos: Movimiento[] }) {
  const [tipo, setTipo] = useState<TipoMovimiento | "TODOS">("TODOS");

  const filtrados = useMemo(
    () => (tipo === "TODOS" ? movimientos : movimientos.filter((m) => m.tipo === tipo)),
    [movimientos, tipo],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Movimiento de Stock"
        description="Historial completo de entradas y salidas de todos los productos."
        action={<ExportarButton reporte="movimiento-stock" />}
      />

      <DataTable
        data={filtrados}
        rowKey={(m) => m.id}
        searchValue={(m) => `${m.productoCodigo} ${m.productoDescripcion} ${m.motivo ?? ""} ${m.usuario}`}
        searchPlaceholder="Buscar por producto, motivo o usuario…"
        emptyMessage="Todavía no hay movimientos de stock registrados."
        pageSize={20}
        actions={
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="max-w-[180px]">
            <option value="TODOS">Todos los tipos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
            <option value="AJUSTE_POSITIVO">Ajuste (+)</option>
            <option value="AJUSTE_NEGATIVO">Ajuste (−)</option>
          </Select>
        }
        columns={[
          {
            key: "fecha",
            header: "Fecha",
            sortValue: (m) => m.fecha,
            render: (m) => new Date(m.fecha).toLocaleDateString("es-UY"),
          },
          {
            key: "producto",
            header: "Producto",
            sortValue: (m) => m.productoDescripcion,
            render: (m) => (
              <div>
                <div className="font-medium text-foreground">{m.productoDescripcion}</div>
                <div className="text-xs text-muted-foreground">{m.productoCodigo}</div>
              </div>
            ),
          },
          {
            key: "tipo",
            header: "Tipo",
            sortValue: (m) => m.tipo,
            render: (m) => <Badge variant={VARIANTE_TIPO[m.tipo]}>{ETIQUETA_TIPO[m.tipo]}</Badge>,
          },
          {
            key: "cantidad",
            header: "Cantidad",
            sortValue: (m) => m.cantidad,
            render: (m) => <span className="font-mono tabular-nums">{m.cantidad}</span>,
          },
          {
            key: "origen",
            header: "Origen",
            sortValue: (m) => m.origenTipo,
            render: (m) => ETIQUETA_ORIGEN[m.origenTipo] ?? m.origenTipo,
          },
          { key: "motivo", header: "Motivo", render: (m) => m.motivo ?? "—" },
          { key: "usuario", header: "Usuario", sortValue: (m) => m.usuario, render: (m) => m.usuario },
        ]}
      />
    </div>
  );
}
