"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField, FieldHint } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Opcion = { id: string; nombre: string };
type Familia = { id: string; nombre: string; categoriaNombre: string };
type Producto = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  descripcion: string;
  subCategoriaId: string;
  marcaId: string;
  moneda: "UYU" | "USD";
  precioCosto: string;
  precioVenta: string;
  stockMinimo: number;
  activo: boolean;
};

export function ProductoFormClient({
  producto,
  subCategorias,
  marcas,
  listasPrecio = [],
  preciosPorListaIniciales = {},
  puedeEditarPrecios,
  puedeEliminar,
}: {
  producto?: Producto;
  subCategorias: Familia[];
  marcas: Opcion[];
  listasPrecio?: Opcion[];
  preciosPorListaIniciales?: Record<string, string>;
  puedeEditarPrecios: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const esEdicion = !!producto;
  const [codigo, setCodigo] = useState(producto?.codigo ?? "");
  const [codigoBarras, setCodigoBarras] = useState(producto?.codigoBarras ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [subCategoriaId, setSubCategoriaId] = useState(producto?.subCategoriaId ?? subCategorias[0]?.id ?? "");
  const [marcaId, setMarcaId] = useState(producto?.marcaId ?? marcas[0]?.id ?? "");
  const [moneda, setMoneda] = useState<"UYU" | "USD">(producto?.moneda ?? "UYU");
  const [precioCosto, setPrecioCosto] = useState(producto?.precioCosto ?? "");
  const [precioVenta, setPrecioVenta] = useState(producto?.precioVenta ?? "");
  const [preciosPorLista, setPreciosPorLista] = useState(preciosPorListaIniciales);
  const [stockMinimo, setStockMinimo] = useState(String(producto?.stockMinimo ?? 0));
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload: Record<string, unknown> = esEdicion
      ? {
          descripcion,
          codigoBarras,
          subCategoriaId,
          marcaId,
          moneda,
          stockMinimo: Number(stockMinimo),
          ...(puedeEditarPrecios ? { precioCosto: Number(precioCosto), precioVenta: Number(precioVenta) } : {}),
          ...(puedeEliminar ? { activo } : {}),
        }
      : {
          codigo,
          codigoBarras,
          descripcion,
          subCategoriaId,
          marcaId,
          moneda,
          precioCosto: precioCosto ? Number(precioCosto) : undefined,
          precioVenta: precioVenta ? Number(precioVenta) : undefined,
          stockMinimo: Number(stockMinimo),
        };

    const res = await fetch(esEdicion ? `/api/productos/${producto.id}` : "/api/productos", {
      method: esEdicion ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setGuardando(false);
      return setError((await res.json()).error);
    }

    // Endpoint aparte (ver precios-lista/route.ts): un precio por lista es
    // un evento de "precios" distinto del precio base. En el alta se hace
    // en un segundo paso porque recién ahí existe el id del producto.
    if (puedeEditarPrecios && listasPrecio.length > 0) {
      const id = esEdicion ? producto.id : (await res.json()).producto.id;
      await fetch(`/api/productos/${id}/precios-lista`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          precios: Object.fromEntries(
            listasPrecio.map((l) => [l.id, preciosPorLista[l.id] ? Number(preciosPorLista[l.id]) : null]),
          ),
        }),
      });
    }

    setGuardando(false);
    router.push("/productos");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={esEdicion ? "Editar producto" : "Nuevo producto"} />

      <Card className="max-w-2xl">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Código" required>
              {esEdicion ? (
                <>
                  <Input value={codigo} disabled />
                  <FieldHint>El código no se puede modificar una vez creado.</FieldHint>
                </>
              ) : (
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: PIN-002" required />
              )}
            </FormField>
            <FormField label="Código de barras">
              <Input
                value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Escaneá o tipeá el código (opcional)"
              />
            </FormField>
          </div>

          <FormField label="Descripción" required>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Latex interior blanco 4L" required />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Familia" required>
              <>
                <Select value={subCategoriaId} onChange={(e) => setSubCategoriaId(e.target.value)}>
                  {subCategorias.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </Select>
                <FieldHint>
                  Categoría: {subCategorias.find((s) => s.id === subCategoriaId)?.categoriaNombre ?? "—"}
                </FieldHint>
              </>
            </FormField>
            <FormField label="Marca" required>
              <Select value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label="Moneda">
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as "UYU" | "USD")}>
                <option value="UYU">Pesos ($)</option>
                <option value="USD">Dólares (US$)</option>
              </Select>
            </FormField>
            <FormField label={`Precio costo (${moneda === "USD" ? "US$" : "$"})`}>
              <Input
                type="number" step="0.01" min="0" placeholder={moneda === "USD" ? "US$" : "$"}
                value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)}
                disabled={esEdicion && !puedeEditarPrecios}
              />
            </FormField>
            <FormField label={`Precio venta (${moneda === "USD" ? "US$" : "$"})`}>
              <Input
                type="number" step="0.01" min="0" placeholder={moneda === "USD" ? "US$" : "$"}
                value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)}
                disabled={esEdicion && !puedeEditarPrecios}
              />
            </FormField>
            <FormField label="Stock mínimo">
              <Input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
            </FormField>
          </div>
          {moneda === "USD" && (
            <FieldHint>Los precios se cargan en dólares. En Ventas y Compras se convierten a pesos con la cotización de Configuración.</FieldHint>
          )}

          {esEdicion && !puedeEditarPrecios && (
            <FieldHint>No tenés permiso para cambiar los precios de este producto.</FieldHint>
          )}

          {puedeEditarPrecios && listasPrecio.length > 0 && (
            <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
              <p className="text-sm font-medium text-foreground">Precios por lista</p>
              <p className="-mt-2 text-xs text-muted-foreground">Vacío = usa el precio de venta base para esa lista.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {listasPrecio.map((l) => (
                  <FormField key={l.id} label={l.nombre}>
                    <Input
                      type="number" step="0.01" min="0" placeholder={`$ ${precioVenta || "0"} (base)`}
                      value={preciosPorLista[l.id] ?? ""}
                      onChange={(e) => setPreciosPorLista((p) => ({ ...p, [l.id]: e.target.value }))}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}

          {esEdicion && puedeEliminar && (
            <Checkbox id="activo" label="Producto activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear producto"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/productos")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
