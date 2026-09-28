import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { condicionBusquedaProductos, COLUMNAS_ORDENABLES, type ColumnaOrden } from "@/lib/buscar-productos";
import { ProductosClient } from "./ProductosClient";

const POR_PAGINA = 25;

function ordenPrisma(columna: ColumnaOrden, dir: "asc" | "desc"): Prisma.ProductoOrderByWithRelationInput[] {
  const principal: Prisma.ProductoOrderByWithRelationInput =
    columna === "codigo" ? { codigo: dir }
    : columna === "familia" ? { subCategoria: { nombre: dir } }
    : columna === "marca" ? { marca: { nombre: dir } }
    : columna === "costo" ? { precioCosto: dir }
    : columna === "venta" ? { precioVenta: dir }
    : columna === "stock" ? { stockActual: dir }
    : columna === "estado" ? { activo: dir }
    : { descripcion: dir };
  // Desempate estable para que la paginación no repita ni saltee filas.
  return [principal, { id: "asc" }];
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; orden?: string; dir?: string };
}) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const q = (searchParams.q ?? "").slice(0, 100);
  const columna = (COLUMNAS_ORDENABLES as readonly string[]).includes(searchParams.orden ?? "")
    ? (searchParams.orden as ColumnaOrden)
    : "descripcion";
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  const where: Prisma.ProductoWhereInput = {
    ferreteriaId: contexto.ferreteriaId,
    ...condicionBusquedaProductos(q, true),
  };

  const total = await prisma.producto.count({ where });
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1), totalPaginas);

  const productosRaw = await prisma.producto.findMany({
    where,
    include: {
      // La Categoría padre viaja junto con la Familia: la jerarquía que ve
      // el usuario es Categoría → Familia → Producto, aunque el modelo se
      // siga llamando SubCategoria adentro.
      subCategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } },
      marca: { select: { nombre: true } },
    },
    orderBy: ordenPrisma(columna, dir),
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
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
      busqueda={{ q, pagina, totalPaginas, total, orden: columna, dir }}
      puedeCrear={tienePermiso(contexto.rol, "productos", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "productos", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
