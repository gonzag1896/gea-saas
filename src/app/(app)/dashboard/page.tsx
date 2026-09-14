import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { totalVentasDelMes, totalComprasDelMes, ventasDiarias, comprasPorProveedor } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DashboardCharts } from "./DashboardCharts";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Igual que el módulo de negocio que ya usa cada rol (sección 6 de la
// matriz): Depósito no ve ventas, Cajero no ve compras — no es un permiso
// propio de "dashboard", es un resumen de lo que cada uno ya puede ver.
export default async function DashboardPage({ searchParams }: { searchParams: { desde?: string; hasta?: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const hasta = searchParams.hasta ? new Date(searchParams.hasta) : new Date();
  const desde = searchParams.desde ? new Date(searchParams.desde) : new Date(hasta.getTime() - 29 * 24 * 60 * 60 * 1000);

  const { ferreteriaId, rol } = contexto;
  const puedeVerVentas = tienePermiso(rol, "ventas", "ver");
  const puedeVerCompras = tienePermiso(rol, "compras", "ver");

  const [ventasMes, comprasMes, diarias, porProveedor] = await Promise.all([
    puedeVerVentas ? totalVentasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCompras ? totalComprasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerVentas ? ventasDiarias(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerCompras ? comprasPorProveedor(ferreteriaId, desde, hasta) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={contexto.ferreteriaNombre} />

      <div className="flex flex-wrap gap-4">
        {ventasMes !== null && (
          <Card className="min-w-[200px]">
            <div className="text-sm text-muted-foreground">Ventas en el mes</div>
            <div className="text-2xl font-semibold text-foreground font-mono tabular-nums">$ {formatoMoneda(ventasMes)}</div>
          </Card>
        )}
        {comprasMes !== null && (
          <Card className="min-w-[200px]">
            <div className="text-sm text-muted-foreground">Compras en el mes</div>
            <div className="text-2xl font-semibold text-foreground font-mono tabular-nums">$ {formatoMoneda(comprasMes)}</div>
          </Card>
        )}
      </div>

      <DashboardCharts
        ventasDiarias={diarias}
        comprasPorProveedor={porProveedor}
        desde={desde.toISOString().slice(0, 10)}
        hasta={hasta.toISOString().slice(0, 10)}
      />
    </div>
  );
}
