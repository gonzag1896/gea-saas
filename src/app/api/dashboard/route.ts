import { NextResponse } from "next/server";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { totalVentasDelMes, totalComprasDelMes, ventasDiarias, comprasPorProveedor } from "@/lib/dashboard";

// Sin matiz "dashboard" propio en la matriz de permisos (sección 6): cada
// sección se muestra si el rol tiene "ver" sobre ese módulo de negocio —
// Depósito no tiene ventas:ver, así que nunca ve cifras de venta acá
// tampoco, ni al revés con Cajero y compras. No es una pantalla aparte
// con su propio permiso, es un resumen de lo que cada rol ya puede ver.
export async function GET(req: Request) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const hasta = url.searchParams.get("hasta") ? new Date(url.searchParams.get("hasta")!) : new Date();
  const desdeParam = url.searchParams.get("desde");
  const desde = desdeParam ? new Date(desdeParam) : new Date(hasta.getTime() - 29 * 24 * 60 * 60 * 1000);

  const { ferreteriaId, rol } = contexto;
  const puedeVerVentas = tienePermiso(rol, "ventas", "ver");
  const puedeVerCompras = tienePermiso(rol, "compras", "ver");

  const [ventasMes, comprasMes, diarias, porProveedor] = await Promise.all([
    puedeVerVentas ? totalVentasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCompras ? totalComprasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerVentas ? ventasDiarias(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerCompras ? comprasPorProveedor(ferreteriaId, desde, hasta) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ventasDelMes: ventasMes,
    comprasDelMes: comprasMes,
    ventasDiarias: diarias,
    comprasPorProveedor: porProveedor,
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  });
}
