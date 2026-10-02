"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CreditCard, TrendingDown, TrendingUp, Phone } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatearFecha } from "@/lib/fecha";

type Movimiento = {
  id: string;
  fecha: Date;
  debe: string;
  haber: string;
  moneda: "UYU" | "USD";
  origenTipo: string;
  referencia: string | null;
  montoRecibido: string | null;
  monedaRecibida: "UYU" | "USD" | null;
  cotizacion: string | null;
  anulado: boolean;
};
type Cliente = { id: string; nombre: string; telefono: string | null };
type Saldo = { saldoUYU: number; saldoUSD: number };

const ETIQUETA_ORIGEN: Record<string, string> = {
  VENTA_CREDITO: "Venta a crédito",
  // VENTA_CONTADO cubre las dos filas del par Debe+Haber de una venta
  // Contado/Débito -- se distinguen abajo (esDeuda) porque el mismo
  // origenTipo etiqueta las dos.
  VENTA_CONTADO: "Venta contado",
  COBRO: "Cobro",
  DEVOLUCION_VENTA: "Devolución",
  ANULACION_VENTA_CREDITO: "Anulación de venta",
  ANULACION_COBRO: "Anulación de cobro",
};

const BADGE_TIPO: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  VENTA_CREDITO: { bg: "bg-red-50", text: "text-red-700", icon: <TrendingDown className="h-4 w-4" /> },
  VENTA_CONTADO: { bg: "bg-green-50", text: "text-green-700", icon: <TrendingUp className="h-4 w-4" /> },
  COBRO: { bg: "bg-green-50", text: "text-green-700", icon: <TrendingUp className="h-4 w-4" /> },
  DEVOLUCION_VENTA: { bg: "bg-blue-50", text: "text-blue-700", icon: <TrendingUp className="h-4 w-4" /> },
  ANULACION_VENTA_CREDITO: { bg: "bg-gray-50", text: "text-gray-700", icon: <TrendingDown className="h-4 w-4" /> },
  ANULACION_COBRO: { bg: "bg-gray-50", text: "text-gray-700", icon: <TrendingDown className="h-4 w-4" /> },
};

const simbolo = (m: "UYU" | "USD") => (m === "USD" ? "US$" : "$");

export function ClienteCuentaCorrienteClient({
  cliente,
  movimientosIniciales,
  saldo,
  cotizacionDolar,
  puedeCobrar,
  puedeAnular,
}: {
  cliente: Cliente;
  movimientosIniciales: Movimiento[];
  saldo: Saldo;
  cotizacionDolar: string | null;
  puedeCobrar: boolean;
  puedeAnular: boolean;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  // `moneda` = en qué moneda paga; `monedaDeuda` = qué deuda cancela. Si
  // difieren es un cobro cruzado y hace falta la cotización.
  const [moneda, setMoneda] = useState<"UYU" | "USD">("UYU");
  const [monedaDeuda, setMonedaDeuda] = useState<"UYU" | "USD">("UYU");
  const [cotizacion, setCotizacion] = useState(cotizacionDolar ?? "");
  const cruzado = moneda !== monedaDeuda;
  const equivalente = cruzado && Number(monto) > 0 && Number(cotizacion) > 0
    ? (monedaDeuda === "UYU" ? Number(monto) * Number(cotizacion) : Number(monto) / Number(cotizacion))
    : null;
  const [referencia, setReferencia] = useState("");
  const [medioPago, setMedioPago] = useState<"CONTADO" | "TRANSFERENCIA" | "DEBITO">("CONTADO");
  const [error, setError] = useState<string | null>(null);
  const [cobroAAnular, setCobroAAnular] = useState<Movimiento | null>(null);
  const [anulando, setAnulando] = useState(false);

  async function anularCobro(motivo: string) {
    if (!cobroAAnular) return;
    setError(null);
    setAnulando(true);
    const res = await fetch(`/api/cobros/${cobroAAnular.id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setAnulando(false);
    setCobroAAnular(null);
    if (!res.ok) return setError((await res.json()).error);
    router.refresh();
  }

  async function registrarCobro(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/clientes/${cliente.id}/cobro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monto: Number(monto),
        moneda: monedaDeuda,
        ...(cruzado && { monedaRecibida: moneda, cotizacion: Number(cotizacion) }),
        referencia: referencia || undefined,
        medioPago,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMonto("");
    setReferencia("");
    router.refresh();
  }

  // Un cliente puede deber en una moneda y tener crédito a favor en la
  // otra al mismo tiempo — son dos saldos independientes, nunca se
  // compensan entre sí.
  const saldos = [
    { moneda: "UYU" as const, simbolo: "$", monto: saldo.saldoUYU },
    { moneda: "USD" as const, simbolo: "US$", monto: saldo.saldoUSD },
  ].filter((s) => s.monto !== 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header con navegación y datos principales */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/clientes" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Clientes
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{cliente.nombre}</h1>
          {cliente.telefono && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {cliente.telefono}
            </p>
          )}
        </div>

        {/* Saldo grande y destacado — pesos y dólares nunca se mezclan: si
            el cliente debe en las dos monedas, son dos tarjetas. */}
        <div className="flex gap-3">
          {saldos.length === 0 && (
            <div className="rounded-lg bg-blue-50 px-6 py-4 text-right">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Saldo</p>
              <p className="text-4xl font-bold font-mono tabular-nums text-blue-700">$0.00</p>
              <p className="mt-2 text-xs font-medium text-blue-700">Sin saldo</p>
            </div>
          )}
          {saldos.map((s) => {
            const esDeuda = s.monto > 0;
            return (
              <div key={s.moneda} className={cn("rounded-lg px-6 py-4 text-right", esDeuda ? "bg-red-50" : "bg-green-50")}>
                <p className="text-sm font-medium text-muted-foreground mb-1">Saldo {s.simbolo}</p>
                <p className={cn("text-4xl font-bold font-mono tabular-nums", esDeuda ? "text-red-700" : "text-green-700")}>
                  {s.simbolo}{Math.abs(s.monto).toFixed(2)}
                </p>
                <p className={cn("text-xs font-medium mt-2", esDeuda ? "text-red-700" : "text-green-700")}>
                  {esDeuda ? "Debe" : "Crédito"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulario de cobro - Mejorado */}
      {puedeCobrar && (
        <Card className="border-2 border-blue-100 bg-blue-50/50">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">Registrar Cobro</h2>
          </div>

          <form onSubmit={registrarCobro} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Monto</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                  required
                  className="text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Paga en</label>
                <Select
                  value={moneda}
                  onChange={(e) => {
                    const m = e.target.value as "UYU" | "USD";
                    setMoneda(m);
                    setMonedaDeuda(m);
                  }}
                >
                  <option value="UYU">Pesos ($)</option>
                  <option value="USD">Dólares (US$)</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Cancela deuda en</label>
                <Select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value as "UYU" | "USD")}>
                  <option value="UYU">Pesos ($)</option>
                  <option value="USD">Dólares (US$)</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Método de Pago</label>
                <Select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
                >
                  <option value="CONTADO">Efectivo</option>
                  <option value="DEBITO">Débito</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Referencia</label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej: Comprobante 123"
                />
              </div>
            </div>

            {cruzado && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Cotización del dólar</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={cotizacion}
                    onChange={(e) => setCotizacion(e.target.value)}
                    required
                  />
                </div>
                <p className="md:col-span-2 self-end pb-2 text-sm text-muted-foreground">
                  {equivalente !== null
                    ? `Entrega ${simbolo(moneda)}${Number(monto).toFixed(2)} y cancela ${simbolo(monedaDeuda)}${equivalente.toFixed(2)} de deuda.`
                    : "Ingresá el monto y la cotización para ver cuánto cancela."}
                </p>
              </div>
            )}

            {error && <Alert>{error}</Alert>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                ✓ Registrar Cobro
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Historial de movimientos */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Historial de Movimientos</h2>

        {movimientosIniciales.length === 0 ? (
          <EmptyState message="Todavía no hay movimientos para este cliente." />
        ) : (
          <div className="overflow-x-auto">
            <div className="space-y-2">
              {movimientosIniciales.map((m) => {
                const esDeuda = Number(m.debe) > 0;
                const badge = BADGE_TIPO[m.origenTipo] || BADGE_TIPO.ANULACION_VENTA_CREDITO;
                const monto = esDeuda ? m.debe : m.haber;
                const etiqueta = m.origenTipo === "VENTA_CONTADO"
                  ? (esDeuda ? "Venta contado" : "Cobrado en el acto")
                  : (ETIQUETA_ORIGEN[m.origenTipo] ?? m.origenTipo);

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn("p-2 rounded-lg", badge.bg)}>
                        <span className={cn("text-lg", badge.text)}>{badge.icon}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{etiqueta}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatearFecha(m.fecha)}
                          {m.montoRecibido && m.monedaRecibida && ` • Recibido ${simbolo(m.monedaRecibida)}${Number(m.montoRecibido).toFixed(2)} a cotización ${Number(m.cotizacion)}`}
                          {m.referencia && ` • ${m.referencia}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <p className={cn(
                        "text-lg font-bold font-mono tabular-nums",
                        esDeuda ? "text-red-600" : "text-green-600",
                        m.anulado && "text-gray-400 line-through"
                      )}>
                        {esDeuda ? "+" : "-"}{m.moneda === "USD" ? "US$" : "$"}{Number(monto).toFixed(2)}
                      </p>
                      {m.anulado && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">Anulado</span>
                      )}
                      {puedeAnular && m.origenTipo === "COBRO" && !m.anulado && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setCobroAAnular(m)}>Anular</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <PromptDialog
        open={cobroAAnular !== null}
        title="Anular cobro"
        label={cobroAAnular ? `Motivo de la anulación del cobro de ${cobroAAnular.moneda === "USD" ? "US$" : "$"}${Number(cobroAAnular.haber).toFixed(2)}` : "Motivo"}
        confirmLabel="Anular cobro"
        loading={anulando}
        onConfirm={anularCobro}
        onCancel={() => setCobroAAnular(null)}
      />
    </div>
  );
}
