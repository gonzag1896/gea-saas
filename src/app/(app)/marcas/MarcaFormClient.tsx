"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Marca = { id: string; nombre: string; activo: boolean };

export function MarcaFormClient({ marca, puedeEliminar }: { marca?: Marca; puedeEliminar: boolean }) {
  const router = useRouter();
  const esEdicion = !!marca;
  const [nombre, setNombre] = useState(marca?.nombre ?? "");
  const [activo, setActivo] = useState(marca?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = { nombre };
    if (esEdicion && puedeEliminar) payload.activo = activo;

    const res = await fetch(esEdicion ? `/api/marcas/${marca.id}` : "/api/marcas", {
      method: esEdicion ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/marcas");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={esEdicion ? "Editar marca" : "Nueva marca"} />

      <Card className="max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Sherwin Williams" required />
          </FormField>

          {esEdicion && puedeEliminar && (
            <Checkbox id="activo" label="Marca activa" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear marca"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/marcas")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
