import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductoFormClient } from "../ProductoFormClient";

export default async function NuevoProductoPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear productos.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  const [familias, marcas, listasPrecio] = await Promise.all([
    prisma.subCategoria.findMany({
      where: { ferreteriaId, activo: true },
      select: { id: true, nombre: true, categoria: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.marca.findMany({ where: { ferreteriaId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.listaPrecio.findMany({ where: { ferreteriaId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (familias.length === 0 || marcas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Nuevo producto" />
        <EmptyState message="Primero cargá al menos una Familia y una Marca activas." />
      </div>
    );
  }

  return (
    <ProductoFormClient
      subCategorias={familias.map((f) => ({ id: f.id, nombre: f.nombre, categoriaNombre: f.categoria.nombre }))}
      marcas={marcas}
      listasPrecio={listasPrecio}
      puedeEditarPrecios={tienePermiso(contexto.rol, "precios", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
