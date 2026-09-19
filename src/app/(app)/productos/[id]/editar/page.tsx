import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ProductoFormClient } from "../../ProductoFormClient";

export default async function EditarProductoPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar productos.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  const [productoRaw, subCategorias, marcas, listasPrecio, preciosExistentes] = await Promise.all([
    prisma.producto.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } }),
    // Sin filtrar por activo=true: si el producto ya estaba asignado a una
    // sub categoría o marca desactivada, tiene que seguir apareciendo en el
    // selector — igual criterio que sub-categorias/[id]/editar con Categoría.
    prisma.subCategoria.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, categoria: { select: { nombre: true } } }, orderBy: { nombre: "asc" } }),
    prisma.marca.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.listaPrecio.findMany({ where: { ferreteriaId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.precioProducto.findMany({ where: { ferreteriaId, productoId: params.id }, select: { listaPrecioId: true, precio: true } }),
  ]);

  if (!productoRaw) {
    return (
      <div>
        <Alert variant="info">Producto no encontrado.</Alert>
      </div>
    );
  }

  const producto = { ...productoRaw, precioCosto: productoRaw.precioCosto.toString(), precioVenta: productoRaw.precioVenta.toString() };
  const preciosPorListaIniciales = Object.fromEntries(preciosExistentes.map((p) => [p.listaPrecioId, p.precio.toString()]));

  return (
    <ProductoFormClient
      producto={producto}
      subCategorias={subCategorias.map((s) => ({ id: s.id, nombre: s.nombre, categoriaNombre: s.categoria.nombre }))}
      marcas={marcas}
      listasPrecio={listasPrecio}
      preciosPorListaIniciales={preciosPorListaIniciales}
      puedeEditarPrecios={tienePermiso(contexto.rol, "precios", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
