import { redirect } from "next/navigation";
import { TrendingUp, ShoppingCart } from "lucide-react";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { totalVentasDelMes, totalComprasDelMes, ventasDiarias, comprasPorProveedor } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DashboardCharts } from "./DashboardCharts";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ icon: Icon, label, valor }: { icon: typeof TrendingUp; label: string; valor: number }) {
  return (
    <Card className="flex min-w-[220px] flex-1 items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">$ {formatoMoneda(valor)}</div>
      </div>
    </Card>
  );
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
        {ventasMes !== null && <KpiCard icon={TrendingUp} label="Ventas en el mes" valor={ventasMes} />}
        {comprasMes !== null && <KpiCard icon={ShoppingCart} label="Compras en el mes" valor={comprasMes} />}
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
