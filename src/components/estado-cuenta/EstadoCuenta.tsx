"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, FileDown, FileText, ArrowDownUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import {
  armarEstadoCuenta,
  formatearDia,
  formatearMonto,
  monedasConMovimientos,
  simboloMoneda,
  type Moneda,
  type MovimientoCuenta,
  type TipoCuenta,
} from "@/lib/estado-cuenta";
import { hoyUruguayComoFecha } from "@/lib/fecha";

type Preset = "todo" | "mes" | "30dias" | "anio";

function rangoPreset(preset: Preset): { desde: string; hasta: string } {
  const hoy = hoyUruguayComoFecha();
  const iso = hoy.toISOString().slice(0, 10);
  if (preset === "mes") return { desde: `${iso.slice(0, 7)}-01`, hasta: "" };
  if (preset === "anio") return { desde: `${iso.slice(0, 4)}-01-01`, hasta: "" };
  if (preset === "30dias") return { desde: new Date(hoy.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), hasta: "" };
  return { desde: "", hasta: "" };
}

const PRESETS: { id: Preset; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "mes", etiqueta: "Este mes" },
  { id: "30dias", etiqueta: "Últimos 30 días" },
  { id: "anio", etiqueta: "Este año" },
];

function leyenda(tipo: TipoCuenta, saldo: number) {
  if (saldo === 0) return "Sin saldo";
  if (tipo === "cliente") return saldo > 0 ? "El cliente adeuda" : "A favor del cliente";
  return saldo > 0 ? "Adeudamos al proveedor" : "A nuestro favor";
}

// Estado de cuenta en formato contable (Debe / Haber / Saldo corriente), con
// período, resumen y descarga en PDF. Lo usan Clientes y Proveedores: los
// números salen de armarEstadoCuenta, la misma función que arma el PDF.
export function EstadoCuenta({
  tipo,
  entidadId,
  movimientos,
  puedeAnular,
  onAnular,
  resaltarId = null,
}: {
  tipo: TipoCuenta;
  entidadId: string;
  movimientos: MovimientoCuenta[];
  puedeAnular: boolean;
  onAnular: (movimientoId: string) => void;
  // Movimiento recién registrado: se resalta y se pasa a su moneda.
  resaltarId?: string | null;
}) {
  const monedas = useMemo(() => monedasConMovimientos(movimientos), [movimientos]);
  const [moneda, setMoneda] = useState<Moneda>(monedas[0] ?? "UYU");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [masRecientesPrimero, setMasRecientesPrimero] = useState(true);

  useEffect(() => {
    const nuevo = resaltarId ? movimientos.find((m) => m.id === resaltarId) : undefined;
    if (nuevo) setMoneda(nuevo.moneda);
  }, [resaltarId, movimientos]);

  const monedaActiva: Moneda = monedas.includes(moneda) ? moneda : (monedas[0] ?? "UYU");
  const estado = useMemo(
    () => armarEstadoCuenta(tipo, movimientos, monedaActiva, { desde: desde || undefined, hasta: hasta || undefined }),
    [tipo, movimientos, monedaActiva, desde, hasta],
  );
  const filas = masRecientesPrimero ? [...estado.filas].reverse() : estado.filas;
  const simbolo = simboloMoneda(monedaActiva);
  const hayPeriodo = Boolean(desde || hasta);
  const mostrarSaldoAnterior = hayPeriodo && estado.saldoAnterior !== 0;
  const accionOriginal = tipo === "cliente" ? "COBRO" : "PAGO";

  function presetActivo(p: Preset) {
    const r = rangoPreset(p);
    return r.desde === desde && r.hasta === hasta;
  }

  function descargarPdf() {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const base = tipo === "cliente" ? "clientes" : "proveedores";
    window.location.href = `/api/${base}/${entidadId}/estado-cuenta?${params}`;
  }

  function descargarRecibo(movimientoId: string) {
    window.location.href = tipo === "cliente" ? `/api/cobros/${movimientoId}/recibo` : `/api/pagos-proveedor/${movimientoId}/recibo`;
  }

  const filaSaldoAnterior =mostrarSaldoAnterior && (
    <tr className="bg-muted/60 text-muted-foreground">
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5 font-medium" colSpan={2}>Saldo anterior al {formatearDia(desde)}</td>
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatearMonto(estado.saldoAnterior)}</td>
      <td />
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Estado de cuenta</h2>
        <Button type="button" variant="outline" onClick={descargarPdf} disabled={movimientos.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <CalendarRange className="mb-2.5 h-4 w-4 text-muted-foreground" />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Desde
            <Input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Hasta
            <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="w-40" />
          </label>
          <div className="flex flex-wrap gap-2 pb-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const r = rangoPreset(p.id);
                  setDesde(r.desde);
                  setHasta(r.hasta);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  presetActivo(p.id) ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted-foreground hover:bg-muted",
                )}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {hayPeriodo ? "El PDF respeta este período e incluye el saldo anterior." : "Sin filtro: se muestra todo el historial. El PDF incluye todos los movimientos."}
        </p>
      </Card>

      {movimientos.length === 0 ? (
        <EmptyState message={tipo === "cliente" ? "Todavía no hay movimientos para este cliente." : "Todavía no hay movimientos para este proveedor."} />
      ) : (
        <>
          {monedas.length > 1 && (
            <div className="inline-flex w-fit rounded-md border border-border bg-surface p-0.5" role="tablist" aria-label="Moneda">
              {monedas.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={m === monedaActiva}
                  onClick={() => setMoneda(m)}
                  className={cn(
                    "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                    m === monedaActiva ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {m === "UYU" ? "Pesos ($)" : "Dólares (US$)"}
                </button>
              ))}
            </div>
          )}

          {/* Resumen del período: lo primero que se lee, antes del detalle */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Resumen etiqueta="Saldo anterior" valor={`${simbolo} ${formatearMonto(estado.saldoAnterior)}`} />
            <Resumen etiqueta="Debe (período)" valor={`${simbolo} ${formatearMonto(estado.totalDebe)}`} />
            <Resumen etiqueta="Haber (período)" valor={`${simbolo} ${formatearMonto(estado.totalHaber)}`} />
            <Resumen etiqueta="Saldo final" valor={`${simbolo} ${formatearMonto(estado.saldoFinal)}`} nota={leyenda(tipo, estado.saldoFinal)} destacado />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Concepto</th>
                  <th className="px-4 py-2.5 font-medium">Detalle</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debe</th>
                  <th className="px-4 py-2.5 text-right font-medium">Haber</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-2 py-2.5 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => setMasRecientesPrimero((v) => !v)}
                      title={masRecientesPrimero ? "Mostrando los más recientes primero" : "Mostrando los más antiguos primero"}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 normal-case tracking-normal text-muted-foreground hover:bg-muted"
                    >
                      <ArrowDownUp className="h-3.5 w-3.5" />
                      {masRecientesPrimero ? "Recientes" : "Antiguos"}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!masRecientesPrimero && filaSaldoAnterior}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin movimientos en este período.</td>
                  </tr>
                )}
                {filas.map((f) => (
                  <tr key={f.id} className={cn("transition-colors hover:bg-muted/40", f.anulado && "text-muted-foreground", f.id === resaltarId && "bg-primary/10")}>
                    <td className="whitespace-nowrap px-4 py-2.5">{formatearDia(f.fecha)}</td>
                    <td className="px-4 py-2.5 font-medium">
                      <span className={cn(f.anulado && "line-through")}>{f.concepto}</span>
                      {f.anulado && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Anulado</span>}
                    </td>
                    <td className="max-w-[260px] px-4 py-2.5 text-muted-foreground">{f.detalle}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{f.debe ? formatearMonto(f.debe) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{f.haber ? formatearMonto(f.haber) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{formatearMonto(f.saldo)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      {f.origenTipo === accionOriginal && (
                        <div className="flex justify-end gap-1.5">
                          <Button type="button" variant="ghost" size="sm" onClick={() => descargarRecibo(f.id)} title="Descargar recibo">
                            <FileText className="mr-1 h-3.5 w-3.5" /> Recibo
                          </Button>
                          {puedeAnular && !f.anulado && (
                            <Button type="button" variant="outline" size="sm" onClick={() => onAnular(f.id)}>Anular</Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {masRecientesPrimero && filaSaldoAnterior}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor, nota, destacado }: { etiqueta: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3", destacado ? "border-primary/30 bg-primary/5" : "border-border bg-surface")}>
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className={cn("mt-1 font-mono tabular-nums text-foreground", destacado ? "text-xl font-bold" : "text-base font-semibold")}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
