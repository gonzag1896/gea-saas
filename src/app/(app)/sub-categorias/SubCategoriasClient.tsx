"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export function SubCategoriasClient({ subCategoriasIniciales, categorias }: { subCategoriasIniciales: SubCategoria[]; categorias: Categoria[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of subCategoriasIniciales) {
        if (next[s.id] !== undefined && next[s.id] === s.activo) {
          delete next[s.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [subCategoriasIniciales]);

  const subCategorias = subCategoriasIniciales.map((s) => (overrides[s.id] !== undefined ? { ...s, activo: overrides[s.id] } : s));

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
    router.refresh();
  }

  async function toggleActivo(sub: SubCategoria) {
    setOverrides((o) => ({ ...o, [sub.id]: !sub.activo }));
    await fetch(`/api/subcategorias/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !sub.activo }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
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
    </div>
  );
}
