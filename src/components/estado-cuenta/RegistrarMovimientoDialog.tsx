"use client";

import { useState } from "react";
import { CheckCircle2, FileDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { formatearMonto, simboloMoneda, type Moneda, type TipoCuenta } from "@/lib/estado-cuenta";

type MedioPago = "CONTADO" | "TRANSFERENCIA" | "DEBITO";

const TEXTOS = {
  cliente: {
    titulo: "Registrar cobro",
    accion: "Registrar cobro",
    todo: "Cobrar todo",
    deuda: "Deuda actual",
    aFavor: "Saldo a favor del cliente",
    despues: "Saldo después del cobro",
    otraMoneda: "El cliente paga en otra moneda",
    entrega: "entrega",
    listo: "Cobro registrado",
    sobrepago: "Queda saldo a favor del cliente por",
    endpoint: (id: string) => `/api/clientes/${id}/cobro`,
    recibo: (id: string) => `/api/cobros/${id}/recibo`,
  },
  proveedor: {
    titulo: "Registrar pago",
    accion: "Registrar pago",
    todo: "Pagar todo",
    deuda: "Deuda actual con el proveedor",
    aFavor: "Saldo a nuestro favor",
    despues: "Saldo después del pago",
    otraMoneda: "Pagás en otra moneda",
    entrega: "entregás",
    listo: "Pago registrado",
    sobrepago: "Queda saldo a nuestro favor por",
    endpoint: (id: string) => `/api/proveedores/${id}/pago`,
    recibo: (id: string) => `/api/pagos-proveedor/${id}/recibo`,
  },
} as const;

const redondear = (n: number) => Math.round(n * 100) / 100;

// Ventana para registrar un cobro (cliente) o un pago (proveedor). Un solo
// formulario corto para el caso normal —se paga en la misma moneda que se
// debe—; pagar en la otra moneda queda detrás de un enlace, porque es la
// excepción. Al guardar muestra la confirmación con el saldo resultante y el
// botón para descargar el recibo. Se monta solo mientras está abierta, así el
// formulario siempre arranca limpio.
export function RegistrarMovimientoDialog({
  tipo,
  entidadId,
  monedaInicial,
  monedasDisponibles,
  saldo,
  cotizacionDolar,
  onClose,
  onRegistrado,
}: {
  tipo: TipoCuenta;
  entidadId: string;
  monedaInicial: Moneda;
  monedasDisponibles: Moneda[];
  saldo: { saldoUYU: number; saldoUSD: number };
  cotizacionDolar: string | null;
  onClose: () => void;
  onRegistrado: (movimientoId: string, moneda: Moneda) => void;
}) {
  const t = TEXTOS[tipo];
  const [monedaDeuda, setMonedaDeuda] = useState<Moneda>(monedaInicial);
  const [otraMoneda, setOtraMoneda] = useState(false);
  const [cotizacion, setCotizacion] = useState(cotizacionDolar ?? "");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("CONTADO");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<{ id: string; saldoDespues: number; moneda: Moneda } | null>(null);

  const deuda = monedaDeuda === "UYU" ? saldo.saldoUYU : saldo.saldoUSD;
  const monedaPaga: Moneda = otraMoneda ? (monedaDeuda === "UYU" ? "USD" : "UYU") : monedaDeuda;
  const montoNum = Number(monto);
  const cot = Number(cotizacion);
  const equivalente =
    montoNum > 0 && (!otraMoneda || cot > 0)
      ? redondear(otraMoneda ? (monedaDeuda === "UYU" ? montoNum * cot : montoNum / cot) : montoNum)
      : null;
  const saldoDespues = equivalente !== null ? redondear(deuda - equivalente) : null;

  function cobrarTodo() {
    if (deuda <= 0) return;
    if (!otraMoneda) return setMonto(deuda.toFixed(2));
    if (!(cot > 0)) return;
    setMonto((monedaDeuda === "UYU" ? deuda / cot : deuda * cot).toFixed(2));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otraMoneda && !(cot > 0)) return setError("Indicá la cotización del dólar.");
    setEnviando(true);
    try {
      const res = await fetch(t.endpoint(entidadId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          moneda: monedaDeuda,
          ...(otraMoneda && { monedaRecibida: monedaPaga, cotizacion: cot }),
          referencia: referencia.trim() || undefined,
          medioPago,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? "No se pudo registrar.");
      setListo({ id: data.id, saldoDespues: saldoDespues ?? deuda, moneda: monedaDeuda });
      onRegistrado(data.id, monedaDeuda);
    } catch {
      setError("No se pudo registrar. Revisá la conexión y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    const s = simboloMoneda(listo.moneda);
    return (
      <Modal
        open
        onClose={onClose}
        title={t.listo}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => (window.location.href = t.recibo(listo.id))}>
              <FileDown className="mr-2 h-4 w-4" /> Descargar recibo
            </Button>
            <Button type="button" onClick={onClose}>Cerrar</Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          <div>
            <p className="font-medium">{t.listo} correctamente.</p>
            <p className="mt-1 text-muted-foreground">
              {t.despues}: <span className="font-mono font-semibold tabular-nums text-foreground">{s} {formatearMonto(listo.saldoDespues)}</span>
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={t.titulo}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        {monedasDisponibles.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Deuda en</span>
            <div className="inline-flex w-fit rounded-md border border-border bg-surface p-0.5" role="tablist">
              {monedasDisponibles.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={m === monedaDeuda}
                  onClick={() => {
                    setMonedaDeuda(m);
                    setMonto("");
                  }}
                  className={cn("rounded px-4 py-1.5 text-sm font-medium transition-colors", m === monedaDeuda ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
                >
                  {m === "UYU" ? "Pesos ($)" : "Dólares (US$)"}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {deuda > 0 ? t.deuda : deuda < 0 ? t.aFavor : "Sin deuda"}
          {deuda !== 0 && (
            <span className="ml-2 font-mono font-semibold tabular-nums">{simboloMoneda(monedaDeuda)} {formatearMonto(Math.abs(deuda))}</span>
          )}
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="monto-movimiento" className="text-xs font-medium text-muted-foreground">
              Monto{otraMoneda ? ` que ${t.entrega} (${simboloMoneda(monedaPaga)})` : ` (${simboloMoneda(monedaDeuda)})`}
            </label>
            {deuda > 0 && (
              <button type="button" onClick={cobrarTodo} className="text-xs font-medium text-primary hover:underline">
                {t.todo} {!otraMoneda && `${simboloMoneda(monedaDeuda)} ${formatearMonto(deuda)}`}
              </button>
            )}
          </div>
          <Input
            id="monto-movimiento"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            autoFocus
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0,00"
            className="text-lg"
          />
        </div>

        {otraMoneda && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cotizacion-movimiento" className="text-xs font-medium text-muted-foreground">Cotización del dólar</label>
            <Input id="cotizacion-movimiento" type="number" step="0.0001" min="0.0001" required value={cotizacion} onChange={(e) => setCotizacion(e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="medio-movimiento" className="text-xs font-medium text-muted-foreground">Medio de pago</label>
            <Select id="medio-movimiento" value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
              <option value="CONTADO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="DEBITO">Débito</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="referencia-movimiento" className="text-xs font-medium text-muted-foreground">Referencia (opcional)</label>
            <Input id="referencia-movimiento" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej: Comprobante 123" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOtraMoneda((v) => !v);
            setMonto("");
          }}
          className="w-fit text-xs font-medium text-primary hover:underline"
        >
          {otraMoneda ? `Volver a ${monedaDeuda === "UYU" ? "pesos" : "dólares"}` : t.otraMoneda}
        </button>

        {saldoDespues !== null && (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            {otraMoneda && equivalente !== null && (
              <p className="text-muted-foreground">
                Cancela <span className="font-mono tabular-nums">{simboloMoneda(monedaDeuda)} {formatearMonto(equivalente)}</span> de deuda.
              </p>
            )}
            <p>
              {t.despues}:{" "}
              <span className="font-mono font-semibold tabular-nums">{simboloMoneda(monedaDeuda)} {formatearMonto(saldoDespues)}</span>
            </p>
            {saldoDespues < 0 && (
              <p className="mt-1 text-warning">
                {t.sobrepago} {simboloMoneda(monedaDeuda)} {formatearMonto(Math.abs(saldoDespues))}.
              </p>
            )}
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="success" loading={enviando}>{t.accion}</Button>
        </div>
      </form>
    </Modal>
  );
}
