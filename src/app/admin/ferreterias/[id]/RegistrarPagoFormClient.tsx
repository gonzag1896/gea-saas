"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatearFechaHoyUruguay } from "@/lib/fecha";

function hoyISO(): string {
  // Input type="date" quiere YYYY-MM-DD — se arma a partir de la fecha de
  // hoy en Uruguay (no la del huso del navegador/servidor).
  const [dia, mes, anio] = formatearFechaHoyUruguay().split("/");
  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function RegistrarPagoFormClient({ ferreteriaId }: { ferreteriaId: string }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/admin/ferreterias/${ferreteriaId}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, monto: monto ? Number(monto) : undefined }),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    setMonto("");
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <FormField label="Fecha del pago" required>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </FormField>
        <FormField label="Monto (opcional)">
          <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="USD 50" />
        </FormField>
      </div>

      {error && <Alert>{error}</Alert>}

      <div>
        <Button type="submit" loading={guardando}>Registrar pago (+1 mes de vigencia)</Button>
      </div>
    </form>
  );
}
