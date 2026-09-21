"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Eye, Ban, Clock, CheckCircle2, XCircle, ArrowUpDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { ExportarButton } from "@/components/ui/ExportarButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

type Estado = "PENDIENTE" | "CONFIRMADO" | "ANULADO";
type MedioPago = "CONTADO" | "CREDITO" | "TRANSFERENCIA";
type Venta = {
  id: string;
  fecha: Date;
  estado: Estado;
  medioPago: MedioPago;
  total: string;
  cliente: { nombre: string };
};
type SortKey = "fecha" | "total";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESTADO_INFO: Record<Estado, { label: string; icon: typeof Clock; cls: string }> = {
  PENDIENTE: { label: "Pendiente", icon: Clock, cls: "bg-orange-50 text-orange-700" },
  CONFIRMADO: { label: "Confirmada", icon: CheckCircle2, cls: "bg-green-50 text-green-700" },
  ANULADO: { label: "Anulada", icon: XCircle, cls: "bg-gray-100 text-gray-500" },
};

function EstadoPill({ estado }: { estado: Estado }) {
  const { label, icon: Icon, cls } = ESTADO_INFO[estado];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", cls)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

const MEDIO_PAGO_INFO: Record<MedioPago, { label: string; cls: string }> = {
  CONTADO: { label: "Contado", cls: "bg-green-50 text-green-700" },
  CREDITO: { label: "Crédito", cls: "bg-orange-50 text-orange-700" },
  TRANSFERENCIA: { label: "Transferencia", cls: "bg-blue-50 text-blue-700" },
};

function MedioPagoTag({ medioPago }: { medioPago: MedioPago }) {
  const { label, cls } = MEDIO_PAGO_INFO[medioPago];
  return <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap", cls)}>{label}</span>;
}

function StatCard({
  icon: Icon, label, valor, sub, tono = "primary",
}: {
  icon: typeof Clock; label: string; valor: string; sub?: string; tono?: "primary" | "warning" | "muted";
}) {
  const tonos = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-orange-50 text-orange-600",
    muted: "bg-gray-100 text-gray-500",
  };
  return (
    <Card className="flex min-w-[180px] flex-1 items-center gap-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tonos[tono])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-lg font-semibold tabular-nums text-foreground">{valor}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}

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
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const pendientes = ventasIniciales.filter((v) => v.estado === "PENDIENTE");
  const confirmadas = ventasIniciales.filter((v) => v.estado === "CONFIRMADO");
  const anuladas = ventasIniciales.filter((v) => v.estado === "ANULADO");
  const totalConfirmado = confirmadas.reduce((acc, v) => acc + Number(v.total), 0);

  const ventasFiltradas = useMemo(() => {
    const filtered = ventasIniciales.filter((v) =>
      `${v.cliente.nombre} ${v.medioPago}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    filtered.sort((a, b) => {
      const cmp = sortKey === "fecha"
        ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        : Number(a.total) - Number(b.total);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [ventasIniciales, busqueda, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);
  const ventasPagina = ventasFiltradas.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "fecha" ? "desc" : "asc");
    }
    setPage(1);
  }

  const SortHeader = ({ label, sortBy, align = "left" }: { label: string; sortBy: SortKey; align?: "left" | "right" }) => (
    <button
      onClick={() => toggleSort(sortBy)}
      className={cn("flex items-center gap-2 font-semibold text-foreground hover:text-blue-600 transition-colors", align === "right" && "ml-auto")}
    >
      {label}
      {sortKey === sortBy && (
        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" && "rotate-180")} />
      )}
    </button>
  );

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
        description="Registrá lo que le vendés a tus clientes. Una venta pendiente no mueve stock ni cuenta corriente hasta que la confirmás desde su detalle."
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

      <div className="flex flex-wrap gap-3">
        <StatCard icon={Clock} label="Pendientes de confirmar" valor={String(pendientes.length)} tono={pendientes.length > 0 ? "warning" : "primary"} />
        <StatCard icon={CheckCircle2} label="Confirmadas" valor={String(confirmadas.length)} sub={`$ ${formatoMoneda(totalConfirmado)} en total`} tono="primary" />
        <StatCard icon={XCircle} label="Anuladas" valor={String(anuladas.length)} tono="muted" />
      </div>

      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Buscar por cliente…"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {ventasFiltradas.length} de {ventasIniciales.length} ventas
        </p>
      </div>

      {ventasFiltradas.length === 0 ? (
        <EmptyState message={busqueda ? "No hay ventas que coincidan con la búsqueda." : "Todavía no registraste ventas. Usá \"Nueva venta\" para cargar la primera."} />
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "31%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Fecha" sortBy="fecha" />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <SortHeader label="Total" sortBy="total" align="right" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {ventasPagina.map((venta) => (
                  <tr
                    key={venta.id}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/ventas/${venta.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(venta.fecha).toLocaleDateString("es-UY")}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate">{venta.cliente.nombre}</p>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold font-mono tabular-nums text-foreground">
                          $ {formatoMoneda(Number(venta.total))}
                        </span>
                        <MedioPagoTag medioPago={venta.medioPago} />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <EstadoPill estado={venta.estado} />
                      </div>
                    </td>

                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip label="Ver detalle" side="left">
                          <Button
                            variant="icon"
                            className="h-8 w-8"
                            aria-label={`Ver detalle de la venta a ${venta.cliente.nombre}`}
                            onClick={() => router.push(`/ventas/${venta.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        {puedeAnular && venta.estado !== "ANULADO" && (
                          <Tooltip label="Anular venta" side="left">
                            <Button
                              variant="icon"
                              className="h-8 w-8 hover:text-danger"
                              aria-label={`Anular venta a ${venta.cliente.nombre}`}
                              onClick={() => setAAnular(venta)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {paginaActual} de {totalPaginas} · {ventasFiltradas.length} resultados</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={paginaActual === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

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
