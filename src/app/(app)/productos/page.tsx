import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductosClient } from "./ProductosClient";

export default async function ProductosPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const [productosRaw, subCategorias, marcas] = await Promise.all([
    prisma.producto.findMany({
      where: { ferreteriaId: contexto.ferreteriaId },
      include: { subCategoria: { select: { nombre: true } }, marca: { select: { nombre: true } } },
      orderBy: { descripcion: "asc" },
    }),
    prisma.subCategoria.findMany({ where: { ferreteriaId: contexto.ferreteriaId }, select: { id: true, nombre: true } }),
    prisma.marca.findMany({ where: { ferreteriaId: contexto.ferreteriaId }, select: { id: true, nombre: true } }),
  ]);

  if (subCategorias.length === 0 || marcas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Productos" />
        <EmptyState message="Primero cargá al menos una Sub Categoría y una Marca." />
      </div>
    );
  }

  // Decimal no cruza el límite Server->Client tal cual — a string, igual
  // que ya hacía NextResponse.json() en la ruta GET original.
  const productos = productosRaw.map((p) => ({
    ...p,
    precioCosto: p.precioCosto.toString(),
    precioVenta: p.precioVenta.toString(),
  }));

  const puedeEditarPrecios = tienePermiso(contexto.rol, "precios", "modificar");

  return (
    <ProductosClient
      productosIniciales={productos}
      subCategorias={subCategorias}
      marcas={marcas}
      puedeEditarPrecios={puedeEditarPrecios}
    />
  );
}
