"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, HandCoins, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { cn } from "@/lib/cn";
import { EstadoCuenta } from "@/components/estado-cuenta/EstadoCuenta";
import { RegistrarMovimientoDialog } from "@/components/estado-cuenta/RegistrarMovimientoDialog";
import { monedasConMovimientos, type Moneda } from "@/lib/estado-cuenta";

type Movimiento = {
  id: string;
  fecha: Date;
  createdAt: Date;
  debe: string;
  haber: string;
  moneda: Moneda;
  origenTipo: string;
  referencia: string | null;
  montoRecibido: string | null;
  monedaRecibida: Moneda | null;
  cotizacion: string | null;
  anulado: boolean;
};
type Cliente = { id: string; nombre: string; telefono: string | null };
type Saldo = { saldoUYU: number; saldoUSD: number };

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
  const [error, setError] = useState<string | null>(null);
  const [cobroAAnular, setCobroAAnular] = useState<Movimiento | null>(null);
  const [anulando, setAnulando] = useState(false);
  // Moneda con la que se abre la ventana de cobro (null = cerrada).
  const [cobrando, setCobrando] = useState<Moneda | null>(null);
  const [resaltarId, setResaltarId] = useState<string | null>(null);

  // El resaltado de la fila recién cobrada dura unos segundos.
  useEffect(() => {
    if (!resaltarId) return;
    const t = setTimeout(() => setResaltarId(null), 8000);
    return () => clearTimeout(t);
  }, [resaltarId]);

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

  // Un cliente puede deber en una moneda y tener crédito a favor en la
  // otra al mismo tiempo — son dos saldos independientes, nunca se
  // compensan entre sí.
  const saldos = [
    { moneda: "UYU" as const, simbolo: "$", monto: saldo.saldoUYU },
    { moneda: "USD" as const, simbolo: "US$", monto: saldo.saldoUSD },
  ].filter((s) => s.monto !== 0);

  const monedasDisponibles: Moneda[] = (() => {
    const m = monedasConMovimientos(movimientosIniciales);
    return m.length > 0 ? m : ["UYU"];
  })();
  // Al abrir desde el botón general se arranca por la moneda en la que debe.
  const monedaConDeuda: Moneda = saldo.saldoUYU > 0 ? "UYU" : saldo.saldoUSD > 0 ? "USD" : monedasDisponibles[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header con navegación, acción principal y saldos */}
      <div className="flex flex-wrap items-start justify-between gap-4">
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
          {puedeCobrar && (
            <Button type="button" variant="success" className="mt-4" onClick={() => setCobrando(monedaConDeuda)}>
              <HandCoins className="mr-2 h-4 w-4" /> Registrar cobro
            </Button>
          )}
        </div>

        {/* Saldo grande y destacado — pesos y dólares nunca se mezclan: si
            el cliente debe en las dos monedas, son dos tarjetas, cada una
            con su propio botón para cobrar esa deuda. */}
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
                {esDeuda && puedeCobrar && (
                  <Button type="button" size="sm" variant="success" className="mt-3" onClick={() => setCobrando(s.moneda)}>
                    Cobrar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <EstadoCuenta
        tipo="cliente"
        entidadId={cliente.id}
        movimientos={movimientosIniciales}
        puedeAnular={puedeAnular}
        onAnular={(id) => setCobroAAnular(movimientosIniciales.find((m) => m.id === id) ?? null)}
        resaltarId={resaltarId}
      />

      {cobrando && (
        <RegistrarMovimientoDialog
          tipo="cliente"
          entidadId={cliente.id}
          monedaInicial={cobrando}
          monedasDisponibles={monedasDisponibles}
          saldo={saldo}
          cotizacionDolar={cotizacionDolar}
          onClose={() => setCobrando(null)}
          onRegistrado={(id) => {
            setResaltarId(id);
            router.refresh();
          }}
        />
      )}

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
