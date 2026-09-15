"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";

type Proveedor = { id: string; nombre: string; rut: string | null; telefono: string | null; email: string | null };

export function ProveedoresClient({ proveedoresIniciales, puedeModificar }: { proveedoresIniciales: Proveedor[]; puedeModificar: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", rut: "", telefono: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [proveedorEnEdicion, setProveedorEnEdicion] = useState<Proveedor | null>(null);
  const [edicion, setEdicion] = useState({ nombre: "", telefono: "", email: "" });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: form.nombre, rut: form.rut || undefined, telefono: form.telefono || undefined, email: form.email || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setForm({ nombre: "", rut: "", telefono: "", email: "" });
    router.refresh();
  }

  function abrirEdicion(proveedor: Proveedor) {
    setProveedorEnEdicion(proveedor);
    setEdicion({ nombre: proveedor.nombre, telefono: proveedor.telefono ?? "", email: proveedor.email ?? "" });
  }

  async function confirmarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!proveedorEnEdicion) return;
    const res = await fetch(`/api/proveedores/${proveedorEnEdicion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: edicion.nombre, telefono: edicion.telefono || undefined, email: edicion.email || undefined }),
    });
    if (!res.ok) setError((await res.json()).error);
    setProveedorEnEdicion(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Proveedores" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" required className="max-w-xs" />
          <Input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="RUT" className="max-w-[160px]" />
          <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" className="max-w-[160px]" />
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="max-w-xs" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={proveedoresIniciales}
        rowKey={(p) => p.id}
        searchValue={(p) => `${p.nombre} ${p.rut ?? ""} ${p.email ?? ""}`}
        searchPlaceholder="Buscar proveedor…"
        emptyMessage="Todavía no hay proveedores cargados."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (p) => p.nombre, render: (p) => p.nombre },
          { key: "rut", header: "RUT", sortValue: (p) => p.rut ?? "", render: (p) => p.rut ?? "—" },
          { key: "telefono", header: "Teléfono", render: (p) => p.telefono ?? "—" },
          { key: "email", header: "Email", render: (p) => p.email ?? "—" },
          ...(puedeModificar
            ? [{ key: "acciones", header: "", render: (p: Proveedor) => <Button variant="secondary" size="sm" onClick={() => abrirEdicion(p)}>Editar</Button> }]
            : []),
        ]}
      />

      <Modal open={proveedorEnEdicion !== null} onClose={() => setProveedorEnEdicion(null)} title="Editar proveedor">
        <form onSubmit={confirmarEdicion} className="flex flex-col gap-3">
          <FormField label="Nombre">
            <Input value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} required autoFocus />
          </FormField>
          <FormField label="Teléfono">
            <Input value={edicion.telefono} onChange={(e) => setEdicion({ ...edicion, telefono: e.target.value })} />
          </FormField>
          <FormField label="Email">
            <Input value={edicion.email} onChange={(e) => setEdicion({ ...edicion, email: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setProveedorEnEdicion(null)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
