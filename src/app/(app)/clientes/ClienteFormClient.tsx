"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Opcion = { id: string; nombre: string };
type Cliente = { id: string; nombre: string; telefono: string | null; activo: boolean; listaPrecioId: string | null };

export function ClienteFormClient({
  cliente,
  listasPrecio = [],
  puedeEliminar = false,
}: {
  cliente?: Cliente;
  listasPrecio?: Opcion[];
  puedeEliminar?: boolean;
}) {
  const router = useRouter();
  const esEdicion = !!cliente;
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [listaPrecioId, setListaPrecioId] = useState(cliente?.listaPrecioId ?? "");
  const [activo, setActivo] = useState(cliente?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = { nombre, telefono: telefono || undefined, listaPrecioId };
    if (esEdicion && puedeEliminar) payload.activo = activo;

    const res = await fetch(esEdicion ? `/api/clientes/${cliente.id}` : "/api/clientes", {
      method: esEdicion ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/clientes");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={esEdicion ? "Editar cliente" : "Nuevo cliente"} />

      <Card className="max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" required />
          </FormField>

          <FormField label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 099 123 456" />
          </FormField>

          {listasPrecio.length > 0 && (
            <FormField label="Lista de precio">
              <Select value={listaPrecioId} onChange={(e) => setListaPrecioId(e.target.value)}>
                <option value="">Ninguna (precio base)</option>
                {listasPrecio.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </Select>
            </FormField>
          )}

          {esEdicion && puedeEliminar && (
            <Checkbox id="activo" label="Cliente activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear cliente"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/clientes")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
