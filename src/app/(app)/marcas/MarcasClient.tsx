"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { ActivoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Marca = { id: string; nombre: string; activo: boolean };

export function MarcasClient({ marcasIniciales }: { marcasIniciales: Marca[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of marcasIniciales) {
        if (next[m.id] !== undefined && next[m.id] === m.activo) {
          delete next[m.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [marcasIniciales]);

  const marcas = marcasIniciales.map((m) => (overrides[m.id] !== undefined ? { ...m, activo: overrides[m.id] } : m));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/marcas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    router.refresh();
  }

  async function toggleActivo(marca: Marca) {
    setOverrides((o) => ({ ...o, [marca.id]: !marca.activo }));
    await fetch(`/api/marcas/${marca.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !marca.activo }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Marcas" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required className="max-w-xs" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Nombre</Table.HeadCell>
            <Table.HeadCell>Estado</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {marcas.map((m) => (
            <Table.Row key={m.id}>
              <Table.Cell>{m.nombre}</Table.Cell>
              <Table.Cell><ActivoBadge activo={m.activo} /></Table.Cell>
              <Table.Cell>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(m)}>
                  {m.activo ? "Desactivar" : "Activar"}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {marcas.length === 0 && <EmptyState message="Todavía no hay marcas cargadas." />}
    </div>
  );
}
