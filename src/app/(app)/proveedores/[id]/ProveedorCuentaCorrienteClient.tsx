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
type Proveedor = { id: string; nombre: string; telefono: string | null };
type Saldo = { saldoUYU: number; saldoUSD: number };

export function ProveedorCuentaCorrienteClient({
  proveedor,
  movimientosIniciales,
  saldo,
  cotizacionDolar,
  puedePagar,
  puedeAnular,
}: {
  proveedor: Proveedor;
  movimientosIniciales: Movimiento[];
  saldo: Saldo;
  cotizacionDolar: string | null;
  puedePagar: boolean;
  puedeAnular: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pagoAAnular, setPagoAAnular] = useState<Movimiento | null>(null);
  const [anulando, setAnulando] = useState(false);
  // Moneda con la que se abre la ventana de pago (null = cerrada).
  const [pagando, setPagando] = useState<Moneda | null>(null);
  const [resaltarId, setResaltarId] = useState<string | null>(null);

  // El resaltado de la fila recién pagada dura unos segundos.
  useEffect(() => {
    if (!resaltarId) return;
    const t = setTimeout(() => setResaltarId(null), 8000);
    return () => clearTimeout(t);
  }, [resaltarId]);

  async function anularPago(motivo: string) {
    if (!pagoAAnular) return;
    setError(null);
    setAnulando(true);
    const res = await fetch(`/api/pagos-proveedor/${pagoAAnular.id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setAnulando(false);
    setPagoAAnular(null);
    if (!res.ok) return setError((await res.json()).error);
    router.refresh();
  }

  // Igual criterio que del lado de clientes: deuda en una moneda y
  // crédito a favor en la otra son dos saldos independientes.
  const saldos = [
    { moneda: "UYU" as const, simbolo: "$", monto: saldo.saldoUYU },
    { moneda: "USD" as const, simbolo: "US$", monto: saldo.saldoUSD },
  ].filter((s) => s.monto !== 0);

  const monedasDisponibles: Moneda[] = (() => {
    const m = monedasConMovimientos(movimientosIniciales);
    return m.length > 0 ? m : ["UYU"];
  })();
  // Al abrir desde el botón general se arranca por la moneda en la que se debe.
  const monedaConDeuda: Moneda = saldo.saldoUYU > 0 ? "UYU" : saldo.saldoUSD > 0 ? "USD" : monedasDisponibles[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header con navegación, acción principal y saldos */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/proveedores" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Proveedores
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{proveedor.nombre}</h1>
          {proveedor.telefono && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {proveedor.telefono}
            </p>
          )}
          {puedePagar && (
            <Button type="button" variant="success" className="mt-4" onClick={() => setPagando(monedaConDeuda)}>
              <HandCoins className="mr-2 h-4 w-4" /> Registrar pago
            </Button>
          )}
        </div>

        {/* Saldo grande y destacado — pesos y dólares nunca se mezclan. */}
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
                  {esDeuda ? "Le debemos" : "A nuestro favor"}
                </p>
                {esDeuda && puedePagar && (
                  <Button type="button" size="sm" variant="success" className="mt-3" onClick={() => setPagando(s.moneda)}>
                    Pagar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <EstadoCuenta
        tipo="proveedor"
        entidadId={proveedor.id}
        movimientos={movimientosIniciales}
        puedeAnular={puedeAnular}
        onAnular={(id) => setPagoAAnular(movimientosIniciales.find((m) => m.id === id) ?? null)}
        resaltarId={resaltarId}
      />

      {pagando && (
        <RegistrarMovimientoDialog
          tipo="proveedor"
          entidadId={proveedor.id}
          monedaInicial={pagando}
          monedasDisponibles={monedasDisponibles}
          saldo={saldo}
          cotizacionDolar={cotizacionDolar}
          onClose={() => setPagando(null)}
          onRegistrado={(id) => {
            setResaltarId(id);
            router.refresh();
          }}
        />
      )}

      <PromptDialog
        open={pagoAAnular !== null}
        title="Anular pago"
        label={pagoAAnular ? `Motivo de la anulación del pago de ${pagoAAnular.moneda === "USD" ? "US$" : "$"}${Number(pagoAAnular.haber).toFixed(2)}` : "Motivo"}
        confirmLabel="Anular pago"
        loading={anulando}
        onConfirm={anularPago}
        onCancel={() => setPagoAAnular(null)}
      />
    </div>
  );
}
