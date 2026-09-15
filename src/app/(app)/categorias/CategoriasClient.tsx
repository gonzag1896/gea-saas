"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge } from "@/components/ui/Badge";

type Categoria = { id: string; nombre: string; activo: boolean };

export function CategoriasClient({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Una vez que router.refresh() trae confirmado el valor que ya
  // adelantamos de forma optimista, el override deja de hacer falta.
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of categoriasIniciales) {
        if (next[c.id] !== undefined && next[c.id] === c.activo) {
          delete next[c.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [categoriasIniciales]);

  const categorias = categoriasIniciales.map((c) => (overrides[c.id] !== undefined ? { ...c, activo: overrides[c.id] } : c));

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    router.refresh();
  }

  async function toggleActivo(categoria: Categoria) {
    setOverrides((o) => ({ ...o, [categoria.id]: !categoria.activo }));
    await fetch(`/api/categorias/${categoria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !categoria.activo }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categorías" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required className="max-w-xs" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={categorias}
        rowKey={(c) => c.id}
        searchValue={(c) => c.nombre}
        searchPlaceholder="Buscar categoría…"
        emptyMessage="Todavía no hay categorías cargadas."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (c) => c.nombre, render: (c) => c.nombre },
          { key: "estado", header: "Estado", sortValue: (c) => Number(c.activo), render: (c) => <ActivoBadge activo={c.activo} /> },
          {
            key: "acciones", header: "", render: (c) => (
              <Button variant="secondary" size="sm" onClick={() => toggleActivo(c)}>
                {c.activo ? "Desactivar" : "Activar"}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
