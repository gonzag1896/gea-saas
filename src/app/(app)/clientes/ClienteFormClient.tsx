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
type Cliente = {
  id: string; nombre: string; rut: string | null; telefono: string | null; email: string | null;
  direccion: string | null; ciudad: string | null; activo: boolean; listaPrecioId: string | null;
};

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
  const [rut, setRut] = useState(cliente?.rut ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion ?? "");
  const [ciudad, setCiudad] = useState(cliente?.ciudad ?? "");
  const [listaPrecioId, setListaPrecioId] = useState(cliente?.listaPrecioId ?? "");
  const [activo, setActivo] = useState(cliente?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = {
      nombre,
      rut: rut || undefined,
      telefono: telefono || undefined,
      email: email || undefined,
      direccion: direccion || undefined,
      ciudad: ciudad || undefined,
      listaPrecioId,
    };
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

          <FormField label="RUT / documento">
            <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="Ej: 210000000012" />
          </FormField>

          <FormField label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 099 123 456" />
          </FormField>

          <FormField label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ej: contacto@cliente.com" />
          </FormField>

          <FormField label="Dirección">
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Av. 18 de Julio 1234" />
          </FormField>

          <FormField label="Ciudad">
            <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Montevideo" />
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
