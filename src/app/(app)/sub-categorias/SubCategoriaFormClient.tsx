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

type Categoria = { id: string; nombre: string };
type SubCategoria = { id: string; nombre: string; activo: boolean; categoriaId: string };

export function SubCategoriaFormClient({
  subCategoria,
  categorias,
  puedeEliminar,
}: {
  subCategoria?: SubCategoria;
  categorias: Categoria[];
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const esEdicion = !!subCategoria;
  const [nombre, setNombre] = useState(subCategoria?.nombre ?? "");
  const [categoriaId, setCategoriaId] = useState(subCategoria?.categoriaId ?? categorias[0]?.id ?? "");
  const [activo, setActivo] = useState(subCategoria?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = { nombre, categoriaId };
    if (esEdicion && puedeEliminar) payload.activo = activo;

    const res = await fetch(esEdicion ? `/api/subcategorias/${subCategoria.id}` : "/api/subcategorias", {
      method: esEdicion ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/sub-categorias");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={esEdicion ? "Editar familia" : "Nueva familia"} />

      <Card className="max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Categoría" required>
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </FormField>

          <FormField label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Taladros" required />
          </FormField>

          {esEdicion && puedeEliminar && (
            <Checkbox id="activo" label="Familia activa" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear familia"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/sub-categorias")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
