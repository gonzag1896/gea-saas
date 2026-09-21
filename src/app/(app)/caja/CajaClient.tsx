"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet, ShoppingCart, CreditCard, CheckCircle2, TrendingUp, TrendingDown, Info, ChevronRight,
  ChevronLeft, ArrowUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatearFecha } from "@/lib/fecha";

type Esperado = { totalVentasContado: number; totalCobrosContado: number; totalEsperado: number };
type Cierre = {
  id: string;
  fecha: string;
  totalVentasContado: number;
  totalCobrosContado: number;
  totalEsperado: number;
  totalContado: number;
  diferencia: number;
  observaciones: string | null;
};
type SortKey = "fecha" | "diferencia";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mismo lenguaje visual que Compras/Ventas/Dashboard: una tarjeta con
// ícono, valor grande y — cuando hay a dónde ir a ver el detalle — un
// chevron que deja claro que se puede hacer click.
function KpiCard({
  icon: Icon, label, valor, sub, tono = "primary", href,
}: {
  icon: typeof Wallet; label: string; valor: string; sub?: string; tono?: "primary" | "success"; href?: string;
}) {
  const tonos = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success" };
  const contenido = (
    <Card className={cn("flex min-w-[220px] flex-1 items-center gap-4 transition-all", href && "cursor-pointer hover:border-primary/40 hover:shadow-md")}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tonos[tono])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{valor}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {href && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </Card>
  );
  return href ? <Link href={href} className="flex flex-1 min-w-[220px]">{contenido}</Link> : contenido;
}

// La diferencia es lo primero que un cajero/dueño necesita entender sin
// ambigüedad: cuadra, falta plata, o sobra plata. Color + ícono + texto,
// nunca solo color, para que no dependa de interpretar un signo.
function DiferenciaPill({ diferencia }: { diferencia: number }) {
  if (diferencia === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-green-50 text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Cuadra exacto
      </span>
    );
  }
  if (diferencia < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-50 text-red-700">
        <TrendingDown className="h-3.5 w-3.5" /> Faltan $ {formatoMoneda(Math.abs(diferencia))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-orange-50 text-orange-700">
      <TrendingUp className="h-3.5 w-3.5" /> Sobran $ {formatoMoneda(diferencia)}
    </span>
  );
}

export function CajaClient({
  esperado,
  yaCerradaHoy,
  cierres,
  puedeCerrar,
}: {
  esperado: Esperado;
  yaCerradaHoy: boolean;
  cierres: Cierre[];
  puedeCerrar: boolean;
}) {
  const router = useRouter();
  const [totalContado, setTotalContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cierreHoy, setCierreHoy] = useState<{ diferencia: number; totalContado: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const diferenciaPreview = totalContado ? Number(totalContado) - esperado.totalEsperado : null;

  const cierresOrdenados = useMemo(() => {
    const copia = [...cierres];
    copia.sort((a, b) => {
      const cmp = sortKey === "fecha"
        ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        : a.diferencia - b.diferencia;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copia;
  }, [cierres, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(cierresOrdenados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);
  const cierresPagina = cierresOrdenados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <button
      onClick={() => toggleSort(sortBy)}
      className="flex items-center gap-2 font-semibold text-foreground hover:text-blue-600 transition-colors"
    >
      {label}
      {sortKey === sortBy && (
        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" && "rotate-180")} />
      )}
    </button>
  );

  async function cerrarCaja(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/caja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: new Date().toISOString(),
        totalContado: Number(totalContado),
        observaciones: observaciones || undefined,
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setCierreHoy({ diferencia: Number(data.cierre.diferencia), totalContado: Number(data.cierre.totalContado) });
    router.refresh();
  }

  const yaCerrada = yaCerradaHoy || cierreHoy !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        description="Cierre diario: lo que el sistema espera contra lo que hay físicamente en el cajón."
      />

      <div className="flex flex-wrap gap-4">
        <KpiCard icon={ShoppingCart} label="Ventas Contado de hoy" valor={`$ ${formatoMoneda(esperado.totalVentasContado)}`} href="/ventas" />
        <KpiCard icon={CreditCard} label="Cobros Contado de hoy" valor={`$ ${formatoMoneda(esperado.totalCobrosContado)}`} href="/cuenta-corriente" />
        <KpiCard
          icon={Wallet}
          label="Total esperado en caja"
          valor={`$ ${formatoMoneda(esperado.totalEsperado)}`}
          sub="Ventas Contado + Cobros Contado"
          tono="success"
        />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        Solo entra a este cálculo lo cobrado en efectivo (Contado). Las ventas a crédito o por transferencia no mueven la caja física, aunque sí aparecen en Ventas y Cuenta Corriente.
      </p>

      {puedeCerrar && !yaCerrada && (
        <Card className="max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Cerrar caja de hoy</h3>
          <form onSubmit={cerrarCaja} className="flex flex-col gap-3">
            <FormField label="Monto contado físicamente" required>
              <Input type="number" step="0.01" min="0" value={totalContado} onChange={(e) => setTotalContado(e.target.value)} placeholder="$" required />
            </FormField>
            {diferenciaPreview !== null && <DiferenciaPill diferencia={diferenciaPreview} />}
            <FormField label="Observaciones">
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" />
            </FormField>
            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit" loading={guardando}>Cerrar caja</Button>
            </div>
          </form>
        </Card>
      )}

      {yaCerrada && !cierreHoy && (
        <Alert variant="info">La caja de hoy ya fue cerrada. Mirá el detalle en el historial.</Alert>
      )}
      {cierreHoy && (
        <Alert variant={cierreHoy.diferencia === 0 ? "success" : "error"}>
          Caja cerrada — contado $ {formatoMoneda(cierreHoy.totalContado)}, diferencia $ {formatoMoneda(cierreHoy.diferencia)}.
        </Alert>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de cierres</h3>

        {cierresOrdenados.length === 0 ? (
          <EmptyState message="Todavía no se cerró la caja ningún día." />
        ) : (
          <>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Fecha" sortBy="fecha" />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                      Esperado
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                      Contado
                    </th>
                    <th className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <SortHeader label="Diferencia" sortBy="diferencia" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Observaciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {cierresPagina.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatearFecha(c.fecha)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-foreground">
                        $ {formatoMoneda(c.totalEsperado)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-foreground">
                        $ {formatoMoneda(c.totalContado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <DiferenciaPill diferencia={c.diferencia} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground truncate">
                        {c.observaciones ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                <span>Página {paginaActual} de {totalPaginas} · {cierresOrdenados.length} resultados</span>
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
      </div>
    </div>
  );
}
