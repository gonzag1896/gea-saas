"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ClienteAutocomplete } from "@/components/ui/ClienteAutocomplete";
import { formatearMonto } from "@/lib/estado-cuenta";

type Opcion = { id: string; nombre: string; rut: string | null };

type VistaPrevia = {
  origen: { id: string; nombre: string; ventas: number; movimientos: number; saldoUYU: number; saldoUSD: number };
  destino: { id: string; nombre: string; saldoUYU: number; saldoUSD: number };
  destinoDespues: { saldoUYU: number; saldoUSD: number };
  camposACopiar: string[];
};

function textoSaldo(uyu: number, usd: number): string {
  const partes: string[] = [];
  if (uyu !== 0) partes.push(`$ ${formatearMonto(uyu)}`);
  if (usd !== 0) partes.push(`US$ ${formatearMonto(usd)}`);
  return partes.length > 0 ? partes.join("  ·  ") : "Sin saldo";
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Une un cliente duplicado con el que se conserva: elegís cuál queda, ves
// exactamente qué se mueve y cómo queda el saldo, y recién ahí confirmás.
export function UnirClienteDialog({
  origen,
  clientes,
  onClose,
  onUnido,
}: {
  origen: { id: string; nombre: string };
  clientes: Opcion[];
  onClose: () => void;
  onUnido: (mensaje: string) => void;
}) {
  const [destinoId, setDestinoId] = useState("");
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatos = useMemo(() => clientes.filter((c) => c.id !== origen.id), [clientes, origen.id]);

  useEffect(() => {
    if (!destinoId) return;
    const controlador = new AbortController();
    setCargando(true);
    setError(null);
    setPrevia(null);
    fetch(`/api/clientes/${origen.id}/unir?destinoId=${encodeURIComponent(destinoId)}`, { signal: controlador.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "No se pudo calcular la unión.");
        setPrevia(data);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false);
      });
    return () => controlador.abort();
  }, [destinoId, origen.id]);

  async function unir() {
    if (!previa) return;
    setUniendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${origen.id}/unir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinoId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? "No se pudo unir los clientes.");
      onUnido(
        `Se unió «${previa.origen.nombre}» con «${previa.destino.nombre}»: ${plural(data.ventas, "venta", "ventas")} y ${plural(data.movimientos, "movimiento", "movimientos")} pasaron al cliente que se conserva.`,
      );
      onClose();
    } catch {
      setError("No se pudo unir los clientes. Revisá la conexión y probá de nuevo.");
    } finally {
      setUniendo(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Unir clientes duplicados"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={uniendo}>Cancelar</Button>
          <Button type="button" variant="danger" onClick={unir} disabled={!previa} loading={uniendo}>Unir clientes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          Duplicado a eliminar: <span className="font-semibold">{origen.nombre}</span>
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Cliente a conservar</span>
          <ClienteAutocomplete clientes={candidatos} seleccionadoId={destinoId} onChange={setDestinoId} placeholder="Buscar el cliente correcto…" />
        </div>

        {cargando && <p className="text-muted-foreground">Calculando…</p>}
        {error && <Alert>{error}</Alert>}

        {previa && (
          <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
            <p>
              Se pasan <span className="font-semibold">{plural(previa.origen.ventas, "venta", "ventas")}</span> y{" "}
              <span className="font-semibold">{plural(previa.origen.movimientos, "movimiento", "movimientos")}</span> de cuenta corriente de «{previa.origen.nombre}» a «{previa.destino.nombre}».
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Saldo de «{previa.origen.nombre}»</dt>
              <dd className="text-right font-mono tabular-nums">{textoSaldo(previa.origen.saldoUYU, previa.origen.saldoUSD)}</dd>
              <dt className="text-muted-foreground">Saldo de «{previa.destino.nombre}» hoy</dt>
              <dd className="text-right font-mono tabular-nums">{textoSaldo(previa.destino.saldoUYU, previa.destino.saldoUSD)}</dd>
              <dt className="font-medium">Queda en «{previa.destino.nombre}»</dt>
              <dd className="text-right font-mono font-semibold tabular-nums">{textoSaldo(previa.destinoDespues.saldoUYU, previa.destinoDespues.saldoUSD)}</dd>
            </dl>
            {previa.camposACopiar.length > 0 && (
              <p className="text-muted-foreground">Se completan en «{previa.destino.nombre}»: {previa.camposACopiar.join(", ")}.</p>
            )}
            <p className="text-warning">«{previa.origen.nombre}» se elimina y la unión no se puede deshacer.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
