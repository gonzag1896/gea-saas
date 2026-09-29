import { NextResponse } from "next/server";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { crearProductoRapidoSchema } from "@/lib/schemas-catalogo";
import { crearProductoPendiente } from "@/lib/producto-rapido";

// Alta mínima de producto desde el punto de venta o de compra, cuando el
// que se busca no está cargado. El permiso es el de esa pantalla (ventas
// o compras "crear"), no "productos:crear" — es a propósito: un Cajero
// puede vender un producto nuevo aunque no pueda dar de alta el catálogo
// completo, porque acá no completa una ficha, solo pone un nombre para no
// frenar la venta.
export async function POST(req: Request) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const permitido = tienePermiso(contexto.rol, "ventas", "crear") || tienePermiso(contexto.rol, "compras", "crear");
  if (!permitido || contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = crearProductoRapidoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const producto = await crearProductoPendiente(contexto.ferreteriaId, parsed.data.descripcion);

  return NextResponse.json(
    {
      producto: {
        id: producto.id,
        codigo: producto.codigo,
        codigoBarras: producto.codigoBarras,
        descripcion: producto.descripcion,
        moneda: producto.moneda,
        precioVenta: producto.precioVenta.toString(),
        precioDeLista: false,
        stockActual: producto.stockActual,
      },
    },
    { status: 201 },
  );
}
