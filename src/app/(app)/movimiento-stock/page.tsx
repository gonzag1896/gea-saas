import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { MovimientoStockClient } from "./MovimientoStockClient";

// Contraparte global de src/app/(app)/productos/[id]/ProductoMovimientosClient.tsx
// (que solo lista movimientos de un producto): esta pantalla es el módulo
// "Movimiento de Stock" de la guía funcional — historial completo de
// entradas y salidas de toda la ferretería, no producto por producto.
export default async function MovimientoStockPage() {
  const contexto = await obtenerContextoTenant();

  if (!contexto || !tienePermiso(contexto.rol, "stock", "ver")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para ver esta página.</Alert>
      </div>
    );
  }

  const movimientosRaw = await prisma.movimientoStock.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    include: {
      producto: { select: { codigo: true, descripcion: true } },
      registradoPor: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const movimientos = movimientosRaw.map((m) => ({
    id: m.id,
    fecha: m.fecha.toISOString(),
    tipo: m.tipo,
    cantidad: m.cantidad,
    motivo: m.motivo,
    origenTipo: m.origenTipo,
    productoCodigo: m.producto.codigo,
    productoDescripcion: m.producto.descripcion,
    usuario: m.registradoPor?.email ?? "—",
  }));

  return <MovimientoStockClient movimientos={movimientos} />;
}
