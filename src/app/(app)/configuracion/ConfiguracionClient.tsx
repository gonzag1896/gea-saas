"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatearFecha } from "@/lib/fecha";

export function ConfiguracionClient({
  cotizacionDolar,
  cotizacionDolarFecha,
  puedeEditar,
}: {
  cotizacionDolar: string | null;
  cotizacionDolarFecha: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(cotizacionDolar ?? "");
  const [consultando, setConsultando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoBcu, setInfoBcu] = useState<string | null>(null);

  async function consultarBcu() {
    setError(null);
    setInfoBcu(null);
    setConsultando(true);
    const res = await fetch("/api/configuracion/cotizacion-bcu");
    const data = await res.json();
    setConsultando(false);
    if (!res.ok) return setError(data.error);
    setValor(String(data.venta));
    setInfoBcu(`BCU al ${formatearFecha(data.fecha)}: compra $${data.compra} · venta $${data.venta}`);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/configuracion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cotizacionDolar: Number(valor) }),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuración" description="Ajustes generales de la ferretería." />

      <Card className="max-w-lg">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="h-4 w-4" /> Cotización del dólar
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Se usa para convertir a pesos los productos con precio en dólares al venderlos o comprarlos.
        </p>

        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="1 USD = $ (pesos)" className="max-w-[160px]">
              <Input
                type="number" step="0.0001" min="0" value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={!puedeEditar}
                required
              />
            </FormField>
            {puedeEditar && (
              <Button type="button" variant="outline" onClick={consultarBcu} loading={consultando}>
                <RefreshCw className="h-4 w-4" /> Consultar BCU
              </Button>
            )}
          </div>

          {infoBcu && <p className="text-xs text-muted-foreground">{infoBcu}</p>}
          {cotizacionDolarFecha && (
            <p className="text-xs text-muted-foreground">
              Última vez guardada: {new Date(cotizacionDolarFecha).toLocaleString("es-UY")}
            </p>
          )}

          {error && <Alert>{error}</Alert>}

          {puedeEditar && (
            <div>
              <Button type="submit" loading={guardando}>Guardar cotización</Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
