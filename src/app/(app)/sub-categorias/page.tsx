"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { ActivoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Categoria = { id: string; nombre: string };
type SubCategoria = { id: string; nombre: string; activo: boolean; categoriaId: string; categoria: { nombre: string } };

export default function SubCategoriasPage() {
  const [subCategorias, setSubCategorias] = useState<SubCategoria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resSub, resCat] = await Promise.all([fetch("/api/subcategorias"), fetch("/api/categorias")]);
    if (resSub.ok) setSubCategorias((await resSub.json()).subCategorias);
    if (resCat.ok) {
      const cats: Categoria[] = (await resCat.json()).categorias;
      setCategorias(cats);
      setCategoriaId((actual) => actual || cats[0]?.id || "");
    }
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/subcategorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, categoriaId }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    cargar();
  }

  async function toggleActivo(sub: SubCategoria) {
    await fetch(`/api/subcategorias/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !sub.activo }),
    });
    cargar();
  }

  if (categorias.length === 0) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title="Sub Categorías" />
        <EmptyState message="Primero creá al menos una categoría." />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Sub Categorías" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="max-w-xs">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required className="max-w-xs" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Nombre</Table.HeadCell>
            <Table.HeadCell>Categoría</Table.HeadCell>
            <Table.HeadCell>Estado</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {subCategorias.map((s) => (
            <Table.Row key={s.id}>
              <Table.Cell>{s.nombre}</Table.Cell>
              <Table.Cell>{s.categoria.nombre}</Table.Cell>
              <Table.Cell><ActivoBadge activo={s.activo} /></Table.Cell>
              <Table.Cell>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(s)}>
                  {s.activo ? "Desactivar" : "Activar"}
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {subCategorias.length === 0 && <EmptyState message="Todavía no hay sub categorías cargadas." />}
    </main>
  );
}
