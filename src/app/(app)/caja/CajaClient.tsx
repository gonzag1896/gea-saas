"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wallet, ShoppingCart, CreditCard, CheckCircle2, TrendingUp, TrendingDown, Info, ChevronRight,
  ChevronLeft, ArrowUpDown, Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

type Esperado = {
  totalVentasContadoUYU: number; totalVentasContadoUSD: number;
  totalCobrosContadoUYU: number; totalCobrosContadoUSD: number;
  totalEsperadoUYU: number; totalEsperadoUSD: number;
};
type Cierre = {
  id: string;
  fecha: string;
  fechaHasta: string;
  montoInicialUYU: number; montoInicialUSD: number;
  totalVentasContadoUYU: number; totalVentasContadoUSD: number;
  totalCobrosContadoUYU: number; totalCobrosContadoUSD: number;
  totalEsperadoUYU: number; totalEsperadoUSD: number;
  totalContadoUYU: number; totalContadoUSD: number;
  diferenciaUYU: number; diferenciaUSD: number;
  observaciones: string | null;
};
type SortKey = "fecha" | "diferencia";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "$ X" y, si hay algo en dólares (monto propio o el de referencia que se
// le pasa), una segunda línea chica "US$ Y" debajo — mismo patrón que ya
// usan las líneas de Ventas/Compras para mostrar el equivalente en dólares.
function MontoDual({ uyu, usd, claseUyu }: { uyu: number; usd: number; claseUyu?: string }) {
  return (
    <div>
      <div className={cn("font-mono tabular-nums", claseUyu)}>$ {formatoMoneda(uyu)}</div>
      {usd !== 0 && <div className="font-mono text-xs tabular-nums text-muted-foreground">US$ {formatoMoneda(usd)}</div>}
    </div>
  );
}

// Mismo lenguaje visual que Compras/Ventas/Dashboard: una tarjeta con
// ícono, valor grande y — cuando hay a dónde ir a ver el detalle — un
// chevron que deja claro que se puede hacer click.
function KpiCard({
  icon: Icon, label, uyu, usd, sub, tono = "primary", href,
}: {
  icon: typeof Wallet; label: string; uyu: number; usd: number; sub?: string; tono?: "primary" | "success"; href?: string;
}) {
  const tonos = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success" };
  const contenido = (
    <Card className={cn("flex min-w-[220px] flex-1 items-center gap-4 transition-all", href && "cursor-pointer hover:border-primary/40 hover:shadow-md")}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tonos[tono])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold"><MontoDual uyu={uyu} usd={usd} /></div>
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
function DiferenciaPill({ diferencia, simbolo = "$" }: { diferencia: number; simbolo?: string }) {
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
        <TrendingDown className="h-3.5 w-3.5" /> Faltan {simbolo} {formatoMoneda(Math.abs(diferencia))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-orange-50 text-orange-700">
      <TrendingUp className="h-3.5 w-3.5" /> Sobran {simbolo} {formatoMoneda(diferencia)}
    </span>
  );
}

function formatearRango(fecha: string, fechaHasta: string) {
  const f1 = new Date(fecha).toLocaleDateString("es-UY", { timeZone: "UTC" });
  if (fecha === fechaHasta) return f1;
  const f2 = new Date(fechaHasta).toLocaleDateString("es-UY", { timeZone: "UTC" });
  return `${f1} – ${f2}`;
}

export function CajaClient({
  esperado,
  yaCerradaHoy,
  hoy,
  cierres,
  puedeCerrar,
  puedeEditar,
}: {
  esperado: Esperado;
  yaCerradaHoy: boolean;
  hoy: string;
  cierres: Cierre[];
  puedeCerrar: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [esperadoRango, setEsperadoRango] = useState<Esperado>(esperado);
  const [cargandoEsperado, setCargandoEsperado] = useState(false);
  const [montoInicialUYU, setMontoInicialUYU] = useState("0");
  const [montoInicialUSD, setMontoInicialUSD] = useState("0");
  const [totalContadoUYU, setTotalContadoUYU] = useState("");
  const [totalContadoUSD, setTotalContadoUSD] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cierreHoy, setCierreHoy] = useState<{ diferenciaUYU: number; diferenciaUSD: number; totalContadoUYU: number; totalContadoUSD: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [aEditar, setAEditar] = useState<Cierre | null>(null);

  // El rango por defecto (hoy-hoy) ya viene calculado del servidor — si el
  // usuario lo cambia, se recalcula el esperado para ese rango sin
  // recargar toda la pantalla.
  useEffect(() => {
    if (desde === hoy && hasta === hoy) {
      setEsperadoRango(esperado);
      return;
    }
    let cancelado = false;
    setCargandoEsperado(true);
    fetch(`/api/caja/esperado?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelado) setEsperadoRango(data); })
      .finally(() => { if (!cancelado) setCargandoEsperado(false); });
    return () => { cancelado = true; };
  }, [desde, hasta, hoy, esperado]);

  const totalEsperadoConFondoUYU = (Number(montoInicialUYU) || 0) + esperadoRango.totalEsperadoUYU;
  const totalEsperadoConFondoUSD = (Number(montoInicialUSD) || 0) + esperadoRango.totalEsperadoUSD;
  const diferenciaPreviewUYU = totalContadoUYU ? Number(totalContadoUYU) - totalEsperadoConFondoUYU : null;
  const diferenciaPreviewUSD = totalContadoUSD ? Number(totalContadoUSD) - totalEsperadoConFondoUSD : null;

  const cierresOrdenados = useMemo(() => {
    const copia = [...cierres];
    copia.sort((a, b) => {
      const cmp = sortKey === "fecha"
        ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        : a.diferenciaUYU - b.diferenciaUYU;
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
        desde: new Date(desde).toISOString(),
        hasta: new Date(hasta).toISOString(),
        montoInicialUYU: Number(montoInicialUYU) || 0,
        montoInicialUSD: Number(montoInicialUSD) || 0,
        totalContadoUYU: Number(totalContadoUYU) || 0,
        totalContadoUSD: Number(totalContadoUSD) || 0,
        observaciones: observaciones || undefined,
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    if (desde === hoy && hasta === hoy) {
      setCierreHoy({
        diferenciaUYU: Number(data.cierre.diferenciaUYU), diferenciaUSD: Number(data.cierre.diferenciaUSD),
        totalContadoUYU: Number(data.cierre.totalContadoUYU), totalContadoUSD: Number(data.cierre.totalContadoUSD),
      });
    }
    router.refresh();
  }

  const yaCerrada = (desde === hoy && hasta === hoy) && (yaCerradaHoy || cierreHoy !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caja"
        description="Cierre diario: lo que el sistema espera contra lo que hay físicamente en el cajón."
      />

      <div className="flex flex-wrap gap-4">
        <KpiCard icon={ShoppingCart} label="Ventas Contado de hoy" uyu={esperado.totalVentasContadoUYU} usd={esperado.totalVentasContadoUSD} href="/ventas" />
        <KpiCard icon={CreditCard} label="Cobros Contado de hoy" uyu={esperado.totalCobrosContadoUYU} usd={esperado.totalCobrosContadoUSD} href="/cuenta-corriente" />
        <KpiCard
          icon={Wallet}
          label="Total esperado en caja"
          uyu={esperado.totalEsperadoUYU}
          usd={esperado.totalEsperadoUSD}
          sub="Ventas Contado + Cobros Contado (sin fondo inicial)"
          tono="success"
        />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        Solo entra a este cálculo lo cobrado en efectivo (Contado). Débito, crédito y transferencia no mueven la caja física — el banco las acredita aparte — aunque sí aparecen en Ventas y Cuenta Corriente.
      </p>

      {puedeCerrar && !yaCerrada && (
        <Card className="max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Cerrar caja</h3>
          <form onSubmit={cerrarCaja} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Desde" required>
                <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }} required />
              </FormField>
              <FormField label="Hasta" required>
                <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required />
              </FormField>
            </div>
            {hasta !== desde && (
              <p className="text-xs text-muted-foreground">
                Vas a cerrar varios días de una vez ({formatearRango(desde, hasta)}). Usalo si la caja quedó sin cerrar un tramo.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fondo inicial ($)" required>
                <Input type="number" step="0.01" min="0" value={montoInicialUYU} onChange={(e) => setMontoInicialUYU(e.target.value)} placeholder="$" required />
              </FormField>
              <FormField label="Fondo inicial (US$)">
                <Input type="number" step="0.01" min="0" value={montoInicialUSD} onChange={(e) => setMontoInicialUSD(e.target.value)} placeholder="US$" />
              </FormField>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Efectivo con el que arrancó la jornada (vuelto), antes de la primera venta — en cada moneda que maneje la caja.</p>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Contado físicamente ($)" required>
                <Input type="number" step="0.01" min="0" value={totalContadoUYU} onChange={(e) => setTotalContadoUYU(e.target.value)} placeholder="$" required />
              </FormField>
              <FormField label="Contado físicamente (US$)">
                <Input type="number" step="0.01" min="0" value={totalContadoUSD} onChange={(e) => setTotalContadoUSD(e.target.value)} placeholder="US$" />
              </FormField>
            </div>

            <p className="text-xs text-muted-foreground">
              Esperado: <span className="font-mono font-medium text-foreground">$ {formatoMoneda(totalEsperadoConFondoUYU)}</span>
              {totalEsperadoConFondoUSD !== 0 && <> · <span className="font-mono font-medium text-foreground">US$ {formatoMoneda(totalEsperadoConFondoUSD)}</span></>}
              {cargandoEsperado && " (recalculando…)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {diferenciaPreviewUYU !== null && <DiferenciaPill diferencia={diferenciaPreviewUYU} />}
              {diferenciaPreviewUSD !== null && diferenciaPreviewUSD !== 0 && <DiferenciaPill diferencia={diferenciaPreviewUSD} simbolo="US$" />}
            </div>

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
        <Alert variant={cierreHoy.diferenciaUYU === 0 && cierreHoy.diferenciaUSD === 0 ? "success" : "error"}>
          Caja cerrada — contado $ {formatoMoneda(cierreHoy.totalContadoUYU)}
          {cierreHoy.totalContadoUSD !== 0 && ` / US$ ${formatoMoneda(cierreHoy.totalContadoUSD)}`}
          , diferencia $ {formatoMoneda(cierreHoy.diferenciaUYU)}
          {cierreHoy.diferenciaUSD !== 0 && ` / US$ ${formatoMoneda(cierreHoy.diferenciaUSD)}`}.
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
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Fecha" sortBy="fecha" />
                    </th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                      Fondo
                    </th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                      Esperado
                    </th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-foreground">
                      Contado
                    </th>
                    <th className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <SortHeader label="Diferencia" sortBy="diferencia" />
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-foreground">
                      Observaciones
                    </th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {cierresPagina.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {formatearRango(c.fecha, c.fechaHasta)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                        <MontoDual uyu={c.montoInicialUYU} usd={c.montoInicialUSD} />
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-foreground">
                        <MontoDual uyu={c.totalEsperadoUYU} usd={c.totalEsperadoUSD} />
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-foreground">
                        <MontoDual uyu={c.totalContadoUYU} usd={c.totalContadoUSD} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <DiferenciaPill diferencia={c.diferenciaUYU} />
                          {c.diferenciaUSD !== 0 && <DiferenciaPill diferencia={c.diferenciaUSD} simbolo="US$" />}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground truncate">
                        {c.observaciones ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {puedeEditar && (
                          <div className="flex items-center justify-end">
                            <Tooltip label="Editar" side="left">
                              <Button variant="icon" className="h-8 w-8" aria-label="Editar cierre" onClick={() => setAEditar(c)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          </div>
                        )}
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

      <EditarCierreModal cierre={aEditar} onClose={() => setAEditar(null)} onSaved={() => { setAEditar(null); router.refresh(); }} />
    </div>
  );
}

function EditarCierreModal({
  cierre,
  onClose,
  onSaved,
}: {
  cierre: Cierre | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [montoInicialUYU, setMontoInicialUYU] = useState("0");
  const [montoInicialUSD, setMontoInicialUSD] = useState("0");
  const [totalContadoUYU, setTotalContadoUYU] = useState("0");
  const [totalContadoUSD, setTotalContadoUSD] = useState("0");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!cierre) return;
    setMontoInicialUYU(String(cierre.montoInicialUYU));
    setMontoInicialUSD(String(cierre.montoInicialUSD));
    setTotalContadoUYU(String(cierre.totalContadoUYU));
    setTotalContadoUSD(String(cierre.totalContadoUSD));
    setObservaciones(cierre.observaciones ?? "");
    setError(null);
  }, [cierre]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cierre) return;
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/caja/${cierre.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        montoInicialUYU: Number(montoInicialUYU) || 0,
        montoInicialUSD: Number(montoInicialUSD) || 0,
        totalContadoUYU: Number(totalContadoUYU) || 0,
        totalContadoUSD: Number(totalContadoUSD) || 0,
        observaciones: observaciones || undefined,
      }),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    onSaved();
  }

  const nuevoEsperadoUYU = cierre ? (Number(montoInicialUYU) || 0) + cierre.totalVentasContadoUYU + cierre.totalCobrosContadoUYU : 0;
  const nuevoEsperadoUSD = cierre ? (Number(montoInicialUSD) || 0) + cierre.totalVentasContadoUSD + cierre.totalCobrosContadoUSD : 0;
  const nuevaDiferenciaUYU = (Number(totalContadoUYU) || 0) - nuevoEsperadoUYU;
  const nuevaDiferenciaUSD = (Number(totalContadoUSD) || 0) - nuevoEsperadoUSD;

  return (
    <Modal open={cierre !== null} onClose={onClose} title={cierre ? `Editar cierre — ${formatearRango(cierre.fecha, cierre.fechaHasta)}` : ""}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Las ventas y cobros del período no se recalculan — solo se corrige el fondo inicial, el monto contado y las observaciones.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Fondo inicial ($)" required>
            <Input type="number" step="0.01" min="0" value={montoInicialUYU} onChange={(e) => setMontoInicialUYU(e.target.value)} required />
          </FormField>
          <FormField label="Fondo inicial (US$)">
            <Input type="number" step="0.01" min="0" value={montoInicialUSD} onChange={(e) => setMontoInicialUSD(e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Contado físicamente ($)" required>
            <Input type="number" step="0.01" min="0" value={totalContadoUYU} onChange={(e) => setTotalContadoUYU(e.target.value)} required />
          </FormField>
          <FormField label="Contado físicamente (US$)">
            <Input type="number" step="0.01" min="0" value={totalContadoUSD} onChange={(e) => setTotalContadoUSD(e.target.value)} />
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">
          Esperado: <span className="font-mono font-medium text-foreground">$ {formatoMoneda(nuevoEsperadoUYU)}</span>
          {nuevoEsperadoUSD !== 0 && <> · <span className="font-mono font-medium text-foreground">US$ {formatoMoneda(nuevoEsperadoUSD)}</span></>}
        </p>
        <div className="flex flex-wrap gap-2">
          <DiferenciaPill diferencia={nuevaDiferenciaUYU} />
          {nuevaDiferenciaUSD !== 0 && <DiferenciaPill diferencia={nuevaDiferenciaUSD} simbolo="US$" />}
        </div>
        <FormField label="Observaciones">
          <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" />
        </FormField>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" loading={guardando}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}
