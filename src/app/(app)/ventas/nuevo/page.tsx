import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { VentaFormClient } from "../VentaFormClient";

export default async function NuevaVentaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "ventas", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para registrar ventas.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  const [clientes, productosRaw, preciosLista, ferreteria] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, listaPrecioId: true } }),
    prisma.producto.findMany({
      where: { ferreteriaId },
      select: { id: true, codigo: true, codigoBarras: true, descripcion: true, moneda: true, precioVenta: true, stockActual: true },
    }),
    // Todos los overrides de todas las listas de una — el volumen de un
    // catálogo de ferretería es chico, sale más barato traerlos todos acá
    // que ir a buscar uno por combinación cliente+producto en Ventas.
    prisma.precioProducto.findMany({ where: { ferreteriaId }, select: { listaPrecioId: true, productoId: true, precio: true } }),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  // Decimal no cruza el límite Server->Client tal cual — a string, para
  // que el escaneo por código de barras y la sugerencia por lista de
  // precio puedan precargar el precio.
  const productos = productosRaw.map((p) => ({ ...p, precioVenta: p.precioVenta.toString() }));

  const preciosPorLista: Record<string, Record<string, string>> = {};
  for (const p of preciosLista) {
    (preciosPorLista[p.listaPrecioId] ??= {})[p.productoId] = p.precio.toString();
  }

  return (
    <VentaFormClient
      clientes={clientes}
      productos={productos}
      preciosPorLista={preciosPorLista}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
    />
  );
}
