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
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatearFecha } from "@/lib/fecha";

type Movimiento = {
  id: string;
  fecha: Date;
  debe: string;
  haber: string;
  origenTipo: string;
  referencia: string | null;
};
type Proveedor = { id: string; nombre: string; telefono: string | null };

const ETIQUETA_ORIGEN: Record<string, string> = {
  COMPRA_CREDITO: "Compra a crédito",
  // COMPRA_CONTADO cubre las dos filas del par Debe+Haber de una compra
  // Contado/Débito -- se distinguen abajo (esDeuda) porque el mismo
  // origenTipo etiqueta las dos.
  COMPRA_CONTADO: "Compra contado",
  PAGO: "Pago",
  DEVOLUCION_COMPRA: "Devolución",
  ANULACION_COMPRA_CREDITO: "Anulación de compra",
};

const BADGE_TIPO: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  COMPRA_CREDITO: { bg: "bg-red-50", text: "text-red-700", icon: <TrendingDown className="h-4 w-4" /> },
  COMPRA_CONTADO: { bg: "bg-green-50", text: "text-green-700", icon: <TrendingUp className="h-4 w-4" /> },
  PAGO: { bg: "bg-green-50", text: "text-green-700", icon: <TrendingUp className="h-4 w-4" /> },
  DEVOLUCION_COMPRA: { bg: "bg-blue-50", text: "text-blue-700", icon: <TrendingUp className="h-4 w-4" /> },
  ANULACION_COMPRA_CREDITO: { bg: "bg-gray-50", text: "text-gray-700", icon: <TrendingDown className="h-4 w-4" /> },
};

export function ProveedorCuentaCorrienteClient({
  proveedor,
  movimientosIniciales,
  saldo,
  puedePagar,
}: {
  proveedor: Proveedor;
  movimientosIniciales: Movimiento[];
  saldo: number;
  puedePagar: boolean;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [medioPago, setMedioPago] = useState<"CONTADO" | "TRANSFERENCIA" | "DEBITO">("CONTADO");
  const [error, setError] = useState<string | null>(null);

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/proveedores/${proveedor.id}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(monto), referencia: referencia || undefined, medioPago }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMonto("");
    setReferencia("");
    router.refresh();
  }

  const saldoAbsoluto = Math.abs(saldo);
  const esDeuda = saldo > 0;
  const esCredito = saldo < 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header con navegación y datos principales */}
      <div className="flex items-start justify-between gap-4">
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
        </div>

        {/* Saldo grande y destacado */}
        <div className={cn(
          "rounded-lg px-6 py-4 text-right",
          esDeuda ? "bg-red-50" : esCredito ? "bg-green-50" : "bg-blue-50"
        )}>
          <p className="text-sm font-medium text-muted-foreground mb-1">Saldo</p>
          <p className={cn(
            "text-4xl font-bold font-mono tabular-nums",
            esDeuda ? "text-red-700" : esCredito ? "text-green-700" : "text-blue-700"
          )}>
            ${saldoAbsoluto.toFixed(2)}
          </p>
          <p className={cn(
            "text-xs font-medium mt-2",
            esDeuda ? "text-red-700" : esCredito ? "text-green-700" : "text-blue-700"
          )}>
            {esDeuda ? "A favor del proveedor" : esCredito ? "Adeudado" : "Sin saldo"}
          </p>
        </div>
      </div>

      {/* Formulario de pago - Mejorado */}
      {puedePagar && (
        <Card className="border-2 border-blue-100 bg-blue-50/50">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">Registrar Pago</h2>
          </div>

          <form onSubmit={registrarPago} className="space-y-4">
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

            {error && <Alert>{error}</Alert>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                ✓ Registrar Pago
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Historial de movimientos */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Historial de Movimientos</h2>

        {movimientosIniciales.length === 0 ? (
          <EmptyState message="Todavía no hay movimientos para este proveedor." />
        ) : (
          <div className="overflow-x-auto">
            <div className="space-y-2">
              {movimientosIniciales.map((m) => {
                const esDeuda = Number(m.debe) > 0;
                const badge = BADGE_TIPO[m.origenTipo] || BADGE_TIPO.ANULACION_COMPRA_CREDITO;
                const monto = esDeuda ? m.debe : m.haber;
                const etiqueta = m.origenTipo === "COMPRA_CONTADO"
                  ? (esDeuda ? "Compra contado" : "Pagado en el acto")
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
                          {m.referencia && ` • ${m.referencia}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "text-lg font-bold font-mono tabular-nums",
                        esDeuda ? "text-red-600" : "text-green-600"
                      )}>
                        {esDeuda ? "+" : "-"}${Number(monto).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
