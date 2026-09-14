"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { ActivoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Categoria = { id: string; nombre: string; activo: boolean };

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/categorias");
    if (res.ok) setCategorias((await res.json()).categorias);
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    cargar();
  }

  async function toggleActivo(categoria: Categoria) {
    await fetch(`/api/categorias/${categoria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !categoria.activo }),
    });
    cargar();
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Categorías" />

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
          {categorias.map((c) => (
            <Table.Row key={c.id}>
              <Table.Cell>{c.nombre}</Table.Cell>
              <Table.Cell><ActivoBadge activo={c.activo} /></Table.Cell>
              <Table.Cell>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(c)}>
                  {c.activo ? "Desactivar" : "Activar"}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {categorias.length === 0 && <EmptyState message="Todavía no hay categorías cargadas." />}
    </main>
  );
}
