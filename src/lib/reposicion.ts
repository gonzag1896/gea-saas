import { prisma } from "@/lib/db";

export type SugerenciaReposicion = {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  stockMinimo: number;
  ventaPromedioDiaria: number;
  diasRestantes: number | null; // null = nunca se vendió en el período (no hay con qué estimar)
  cantidadSugerida: number;
};

// A diferencia del "stock bajo" del dashboard (reactivo: stockActual <=
// stockMinimo), esto es predictivo — agarra también productos que hoy
// están arriba del mínimo pero que al ritmo de venta actual se van a
// quedar sin stock pronto, para reponer antes de que sea tarde.
export async function sugerirReposicion(
  ferreteriaId: string,
  { diasHistorial = 30, diasCobertura = 30, umbralDiasRestantes = 14 } = {},
): Promise<SugerenciaReposicion[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasHistorial);

  const [productos, ventasPorProducto] = await Promise.all([
    prisma.producto.findMany({
      where: { ferreteriaId, activo: true },
      select: { id: true, codigo: true, descripcion: true, stockActual: true, stockMinimo: true },
    }),
    prisma.ventaDetalle.groupBy({
      by: ["productoId"],
      where: { ferreteriaId, venta: { estado: "CONFIRMADO", fecha: { gte: desde } } },
      _sum: { cantidad: true },
    }),
  ]);

  const vendidoPorProducto = new Map(ventasPorProducto.map((v) => [v.productoId, v._sum.cantidad ?? 0]));

  const sugerencias = productos.map((p): SugerenciaReposicion => {
    const vendido = vendidoPorProducto.get(p.id) ?? 0;
    const ventaPromedioDiaria = vendido / diasHistorial;
    const diasRestantes = ventaPromedioDiaria > 0 ? p.stockActual / ventaPromedioDiaria : null;
    const cantidadSugerida = Math.max(0, Math.ceil(ventaPromedioDiaria * diasCobertura - p.stockActual));
    return { ...p, ventaPromedioDiaria, diasRestantes, cantidadSugerida };
  });

  // Alerta si ya está por debajo del mínimo (reactivo) O si al ritmo
  // actual se agota dentro del umbral (predictivo). Un producto que nunca
  // se vendió pero ya está bajo el mínimo igual entra — diasRestantes
  // queda null (no hay ritmo para estimarlo) pero la alerta es real.
  return sugerencias
    .filter((s) => s.stockActual <= s.stockMinimo || (s.diasRestantes !== null && s.diasRestantes <= umbralDiasRestantes))
    .sort((a, b) => (a.diasRestantes ?? -1) - (b.diasRestantes ?? -1));
}
