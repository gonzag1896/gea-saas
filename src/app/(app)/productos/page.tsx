import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ProductosClient } from "./ProductosClient";

export default async function ProductosPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const productosRaw = await prisma.producto.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    include: {
      // La Categoría padre viaja junto con la Familia: la jerarquía que ve
      // el usuario es Categoría → Familia → Producto, aunque el modelo se
      // siga llamando SubCategoria adentro.
      subCategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      marca: { select: { nombre: true } },
    },
    orderBy: { descripcion: "asc" },
  });

  // Decimal no cruza el límite Server->Client tal cual — a string, igual
  // que ya hacía NextResponse.json() en la ruta GET original.
  const productos = productosRaw.map((p) => ({
    ...p,
    precioCosto: p.precioCosto.toString(),
    precioVenta: p.precioVenta.toString(),
  }));

  return (
    <ProductosClient
      productosIniciales={productos}
      puedeCrear={tienePermiso(contexto.rol, "productos", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "productos", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
