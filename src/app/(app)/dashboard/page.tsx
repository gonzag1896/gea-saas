import { redirect } from "next/navigation";
import { TrendingUp, ShoppingCart, Zap, Wallet, AlertTriangle, Clock } from "lucide-react";
import { obtenerContextoTenant, obtenerSesionValidada } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import {
  totalVentasDelMes, totalComprasDelMes, totalVentasHoy, totalPorCobrar, productosStockBajo,
  ventasDiarias, comprasPorProveedor,
} from "@/lib/dashboard";
import { clientesConSaldoVencido } from "@/lib/cuenta-corriente";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardCharts } from "./DashboardCharts";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({
  icon: Icon, label, valor, moneda = true, tono = "primary",
}: {
  icon: typeof TrendingUp; label: string; valor: number; moneda?: boolean; tono?: "primary" | "warning";
}) {
  return (
    <Card className="flex min-w-[220px] flex-1 items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tono === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{moneda ? `$ ${formatoMoneda(valor)}` : valor}</div>
      </div>
    </Card>
  );
}

// Igual que el módulo de negocio que ya usa cada rol (sección 6 de la
// matriz): Depósito no ve ventas ni cuenta corriente, Cajero no ve
// compras — no es un permiso propio de "dashboard", es un resumen de lo
// que cada uno ya puede ver. Pensado para leerse en 30 segundos: primero
// "hoy" (lo urgente/accionable), después "este mes" (la tendencia).
export default async function DashboardPage({ searchParams }: { searchParams: { desde?: string; hasta?: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) {
    // Un Super Admin sin ferretería en modo soporte no tiene contexto de
    // negocio (obtenerContextoTenant exige ferreteriaId) pero SÍ tiene
    // sesión válida — mandarlo a /login como a cualquier otro caso de
    // contexto nulo lo devolvía derecho para acá y armaba un loop
    // infinito. Se lo manda a elegir ferretería, como corresponde.
    const session = await obtenerSesionValidada();
    if (session?.user.isSuperAdmin) redirect("/seleccionar-ferreteria");
    redirect("/login");
  }

  const hasta = searchParams.hasta ? new Date(searchParams.hasta) : new Date();
  const desde = searchParams.desde ? new Date(searchParams.desde) : new Date(hasta.getTime() - 29 * 24 * 60 * 60 * 1000);

  const { ferreteriaId, rol } = contexto;
  const puedeVerVentas = tienePermiso(rol, "ventas", "ver");
  const puedeVerCompras = tienePermiso(rol, "compras", "ver");
  const puedeVerCuentaCorriente = tienePermiso(rol, "cuentaCorriente", "ver");

  const [ventasHoy, ventasMes, comprasMes, porCobrar, cuentasVencidas, stockBajo, diarias, porProveedor] = await Promise.all([
    puedeVerVentas ? totalVentasHoy(ferreteriaId) : Promise.resolve(null),
    puedeVerVentas ? totalVentasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCompras ? totalComprasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCuentaCorriente ? totalPorCobrar(ferreteriaId) : Promise.resolve(null),
    puedeVerCuentaCorriente ? clientesConSaldoVencido(ferreteriaId) : Promise.resolve(null),
    productosStockBajo(ferreteriaId),
    puedeVerVentas ? ventasDiarias(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerCompras ? comprasPorProveedor(ferreteriaId, desde, hasta) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={contexto.ferreteriaNombre} />

      <div className="flex flex-wrap gap-4">
        {ventasHoy !== null && <KpiCard icon={Zap} label="Ventas de hoy" valor={ventasHoy} />}
        {porCobrar !== null && <KpiCard icon={Wallet} label="Por cobrar (cuenta corriente)" valor={porCobrar} tono={porCobrar > 0 ? "warning" : "primary"} />}
        {cuentasVencidas !== null && (
          <KpiCard icon={Clock} label="Cuentas vencidas (+30 días)" valor={cuentasVencidas.length} moneda={false} tono={cuentasVencidas.length > 0 ? "warning" : "primary"} />
        )}
        <KpiCard icon={AlertTriangle} label="Productos con stock bajo" valor={stockBajo.length} moneda={false} tono={stockBajo.length > 0 ? "warning" : "primary"} />
      </div>

      <div className="flex flex-wrap gap-4">
        {ventasMes !== null && <KpiCard icon={TrendingUp} label="Ventas en el mes" valor={ventasMes} />}
        {comprasMes !== null && <KpiCard icon={ShoppingCart} label="Compras en el mes" valor={comprasMes} />}
      </div>

      {cuentasVencidas !== null && cuentasVencidas.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Clientes con saldo vencido</h3>
          <div className="flex flex-col divide-y divide-border">
            {cuentasVencidas.map((c) => (
              <a key={c.id} href={`/clientes/${c.id}`} className="flex items-center justify-between py-2 text-sm hover:bg-muted">
                <div>
                  <span className="font-medium text-foreground">{c.nombre}</span>
                  <span className="ml-2 text-muted-foreground">hace {c.diasVencido} días</span>
                </div>
                <span className="font-mono tabular-nums text-warning">$ {formatoMoneda(c.saldo)}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {stockBajo.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Productos para reponer</h3>
          <div className="flex flex-col divide-y divide-border">
            {stockBajo.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">{p.descripcion}</span>
                  <span className="ml-2 text-muted-foreground">{p.codigo}</span>
                </div>
                <span className="font-mono tabular-nums text-warning">{p.stockActual} / mín. {p.stockMinimo}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {stockBajo.length === 0 && (
        <EmptyState message="Ningún producto por debajo de su stock mínimo. Todo en orden." />
      )}

      <DashboardCharts
        ventasDiarias={diarias}
        comprasPorProveedor={porProveedor}
        desde={desde.toISOString().slice(0, 10)}
        hasta={hasta.toISOString().slice(0, 10)}
      />
    </div>
  );
}
