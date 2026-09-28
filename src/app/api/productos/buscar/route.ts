import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { condicionBusquedaProductos } from "@/lib/buscar-productos";

const LIMITE = 20;

// Buscador liviano para los formularios de Compras y Ventas: devuelve
// como mucho 20 productos en vez de mandar todo el catálogo al navegador.
//   ?q=texto            búsqueda parcial por código / descripción / código de barras
//   ?codigoBarras=...   coincidencia exacta (escáner)
//   ?id=...             un producto puntual (re-consultar su precio)
//   ?listaPrecioId=...  si el producto tiene precio en esa lista, se devuelve ese
export async function GET(req: Request) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const permitido =
    tienePermiso(contexto.rol, "ventas", "crear") ||
    tienePermiso(contexto.rol, "compras", "crear") ||
    tienePermiso(contexto.rol, "productos", "ver");
  if (!permitido) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const codigoBarras = searchParams.get("codigoBarras");
  const id = searchParams.get("id");
  const listaPrecioId = searchParams.get("listaPrecioId");

  const filtro = codigoBarras
    ? { codigoBarras }
    : id
      ? { id }
      : condicionBusquedaProductos(q);

  const productos = await prisma.producto.findMany({
    where: { ferreteriaId: contexto.ferreteriaId, activo: true, ...filtro },
    select: { id: true, codigo: true, codigoBarras: true, descripcion: true, moneda: true, precioVenta: true, stockActual: true },
    orderBy: { descripcion: "asc" },
    take: LIMITE,
  });

  const preciosLista = listaPrecioId && productos.length > 0
    ? await prisma.precioProducto.findMany({
        where: { ferreteriaId: contexto.ferreteriaId, listaPrecioId, productoId: { in: productos.map((p) => p.id) } },
        select: { productoId: true, precio: true },
      })
    : [];
  const precioPorProducto = new Map(preciosLista.map((p) => [p.productoId, p.precio.toString()]));

  return NextResponse.json({
    productos: productos.map((p) => {
      const deLista = precioPorProducto.get(p.id);
      return { ...p, precioVenta: deLista ?? p.precioVenta.toString(), precioDeLista: deLista !== undefined };
    }),
  });
}
