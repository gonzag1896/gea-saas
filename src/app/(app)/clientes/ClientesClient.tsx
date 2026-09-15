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

type Cliente = { id: string; nombre: string; telefono: string | null };

export function ClientesClient({ clientesIniciales, puedeModificar }: { clientesIniciales: Cliente[]; puedeModificar: boolean }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [edicion, setEdicion] = useState({ nombre: "", telefono: "" });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, telefono: telefono || undefined }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    setTelefono("");
    router.refresh();
  }

  function abrirEdicion(cliente: Cliente) {
    setClienteEnEdicion(cliente);
    setEdicion({ nombre: cliente.nombre, telefono: cliente.telefono ?? "" });
  }

  async function confirmarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteEnEdicion) return;
    await fetch(`/api/clientes/${clienteEnEdicion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: edicion.nombre, telefono: edicion.telefono || undefined }),
    });
    setClienteEnEdicion(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clientes" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required className="max-w-xs" />
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" className="max-w-xs" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={clientesIniciales}
        rowKey={(c) => c.id}
        searchValue={(c) => `${c.nombre} ${c.telefono ?? ""}`}
        searchPlaceholder="Buscar cliente…"
        emptyMessage="Todavía no hay clientes cargados."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (c) => c.nombre, render: (c) => c.nombre },
          { key: "telefono", header: "Teléfono", sortValue: (c) => c.telefono ?? "", render: (c) => c.telefono ?? "—" },
          {
            key: "acciones", header: "", render: (c) => (
              <div className="flex items-center gap-2">
                <a href={`/clientes/${c.id}`} className="text-sm text-primary underline underline-offset-2">Cuenta corriente</a>
                {puedeModificar && <Button variant="secondary" size="sm" onClick={() => abrirEdicion(c)}>Editar</Button>}
              </div>
            ),
          },
        ]}
      />

      <Modal open={clienteEnEdicion !== null} onClose={() => setClienteEnEdicion(null)} title="Editar cliente">
        <form onSubmit={confirmarEdicion} className="flex flex-col gap-3">
          <FormField label="Nombre">
            <Input value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} required autoFocus />
          </FormField>
          <FormField label="Teléfono">
            <Input value={edicion.telefono} onChange={(e) => setEdicion({ ...edicion, telefono: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setClienteEnEdicion(null)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
