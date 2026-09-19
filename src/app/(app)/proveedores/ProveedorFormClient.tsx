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

type Proveedor = { id: string; nombre: string; rut: string | null; telefono: string | null; email: string | null; activo: boolean };

export function ProveedorFormClient({ proveedor, puedeEliminar = false }: { proveedor?: Proveedor; puedeEliminar?: boolean }) {
  const router = useRouter();
  const esEdicion = !!proveedor;
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? "",
    rut: proveedor?.rut ?? "",
    telefono: proveedor?.telefono ?? "",
    email: proveedor?.email ?? "",
  });
  const [activo, setActivo] = useState(proveedor?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      rut: form.rut || undefined,
      telefono: form.telefono || undefined,
      email: form.email || undefined,
    };
    if (esEdicion && puedeEliminar) payload.activo = activo;

    const res = await fetch(esEdicion ? `/api/proveedores/${proveedor.id}` : "/api/proveedores", {
      method: esEdicion ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/proveedores");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={esEdicion ? "Editar proveedor" : "Nuevo proveedor"} />

      <Card className="max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Nombre" required>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Distribuidora del Este" required />
          </FormField>

          <FormField label="RUT">
            <Input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="Ej: 210000000012" />
          </FormField>

          <FormField label="Teléfono">
            <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: 099 123 456" />
          </FormField>

          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ej: contacto@proveedor.com" />
          </FormField>

          {esEdicion && puedeEliminar && (
            <Checkbox id="activo" label="Proveedor activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear proveedor"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/proveedores")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
