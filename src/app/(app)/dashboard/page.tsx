import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, ShoppingCart, Zap, Wallet, AlertTriangle, Clock, ChevronRight, Minus,
} from "lucide-react";
import { obtenerContextoTenant, obtenerSesionValidada } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import {
  totalVentasDelMes, totalComprasDelMes, totalVentasHoy, totalComprasHoy, totalPorCobrar, productosStockBajo,
  ventasDiarias, comprasDiarias, comprasPorProveedor, ventasPorMedioPago, topProductosVendidos,
} from "@/lib/dashboard";
import { clientesConSaldoVencido } from "@/lib/cuenta-corriente";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { DashboardCharts } from "./DashboardCharts";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TONOS = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-orange-50 text-orange-600",
  success: "bg-green-50 text-green-600",
  danger: "bg-red-50 text-red-600",
  muted: "bg-gray-100 text-gray-500",
};

// Toda tarjeta de KPI del dashboard lleva a la pantalla donde ese número
// se explica y se puede actuar sobre él — el objetivo es que nadie tenga
// que adivinar "¿y esto de dónde sale?": un click y está en el detalle.
function KpiCard({
  icon: Icon, label, valor, sub, tono = "primary", href,
}: {
  icon: typeof TrendingUp; label: string; valor: string; sub?: string; tono?: keyof typeof TONOS; href?: string;
}) {
  const contenido = (
    <Card
      className={cn(
        "flex min-w-[220px] flex-1 items-center gap-4 transition-all",
        href && "cursor-pointer hover:border-primary/40 hover:shadow-md",
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", TONOS[tono])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{valor}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {href && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </Card>
  );

  return href ? <Link href={href} className="flex flex-1 min-w-[220px]">{contenido}</Link> : contenido;
}

// Igual que el módulo de negocio que ya usa cada rol (sección 6 de la
// matriz): Depósito no ve ventas ni cuenta corriente, Cajero no ve
// compras — no es un permiso propio de "dashboard", es un resumen de lo
// que cada uno ya puede ver. Pensado para leerse en 30 segundos: primero
// "hoy" (lo urgente/accionable), después "este mes" (la tendencia), y
// abajo los gráficos para decisiones de fondo (margen, flujo de caja,
// qué reponer, con qué proveedor negociar).
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

  const [
    ventasHoy, comprasHoy, ventasMes, comprasMes, porCobrar, cuentasVencidas, stockBajo,
    diariasVentas, diariasCompras, porProveedor, porMedioPago, topProductos,
  ] = await Promise.all([
    puedeVerVentas ? totalVentasHoy(ferreteriaId) : Promise.resolve(null),
    puedeVerCompras ? totalComprasHoy(ferreteriaId) : Promise.resolve(null),
    puedeVerVentas ? totalVentasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCompras ? totalComprasDelMes(ferreteriaId) : Promise.resolve(null),
    puedeVerCuentaCorriente ? totalPorCobrar(ferreteriaId) : Promise.resolve(null),
    puedeVerCuentaCorriente ? clientesConSaldoVencido(ferreteriaId) : Promise.resolve(null),
    productosStockBajo(ferreteriaId),
    puedeVerVentas ? ventasDiarias(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerCompras ? comprasDiarias(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerCompras ? comprasPorProveedor(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerVentas ? ventasPorMedioPago(ferreteriaId, desde, hasta) : Promise.resolve(null),
    puedeVerVentas ? topProductosVendidos(ferreteriaId, desde, hasta) : Promise.resolve(null),
  ]);

  const margenMes = ventasMes !== null && comprasMes !== null ? ventasMes - comprasMes : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`${contexto.ferreteriaNombre} — así está tu negocio ahora mismo. Tocá cualquier indicador para ver el detalle.`}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hoy</h2>
        <div className="flex flex-wrap gap-4">
          {ventasHoy !== null && <KpiCard icon={Zap} label="Ventas de hoy" valor={`$ ${formatoMoneda(ventasHoy)}`} href="/ventas" />}
          {comprasHoy !== null && <KpiCard icon={ShoppingCart} label="Compras de hoy" valor={`$ ${formatoMoneda(comprasHoy)}`} href="/compras" />}
          {porCobrar !== null && (
            <KpiCard
              icon={Wallet}
              label="Por cobrar (cuenta corriente)"
              valor={`$ ${formatoMoneda(porCobrar)}`}
              tono={porCobrar > 0 ? "warning" : "primary"}
              href="/cuenta-corriente"
            />
          )}
          {cuentasVencidas !== null && (
            <KpiCard
              icon={Clock}
              label="Cuentas vencidas (+30 días)"
              valor={String(cuentasVencidas.length)}
              sub={cuentasVencidas.length > 0 ? "Requieren seguimiento" : undefined}
              tono={cuentasVencidas.length > 0 ? "warning" : "primary"}
              href="/cuenta-corriente"
            />
          )}
          <KpiCard
            icon={AlertTriangle}
            label="Productos con stock bajo"
            valor={String(stockBajo.length)}
            sub={stockBajo.length > 0 ? "Ver sugerencia de reposición" : undefined}
            tono={stockBajo.length > 0 ? "warning" : "primary"}
            href="/reposicion"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Este mes</h2>
        <div className="flex flex-wrap gap-4">
          {ventasMes !== null && <KpiCard icon={TrendingUp} label="Ventas en el mes" valor={`$ ${formatoMoneda(ventasMes)}`} href="/ventas" />}
          {comprasMes !== null && <KpiCard icon={ShoppingCart} label="Compras en el mes" valor={`$ ${formatoMoneda(comprasMes)}`} href="/compras" />}
          {margenMes !== null && (
            <KpiCard
              icon={margenMes > 0 ? TrendingUp : margenMes < 0 ? TrendingDown : Minus}
              label="Margen bruto del mes"
              valor={`${margenMes >= 0 ? "" : "-"}$ ${formatoMoneda(Math.abs(margenMes))}`}
              sub="Ventas − Compras confirmadas"
              tono={margenMes > 0 ? "success" : margenMes < 0 ? "danger" : "muted"}
            />
          )}
        </div>
      </div>

      {cuentasVencidas !== null && cuentasVencidas.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Clientes con saldo vencido</h3>
          <div className="flex flex-col divide-y divide-border">
            {cuentasVencidas.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center justify-between py-2 text-sm hover:bg-muted">
                <div>
                  <span className="font-medium text-foreground">{c.nombre}</span>
                  <span className="ml-2 text-muted-foreground">hace {c.diasVencido} días</span>
                </div>
                <span className="font-mono tabular-nums text-warning">$ {formatoMoneda(c.saldo)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {stockBajo.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Productos para reponer</h3>
            <Link href="/reposicion" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Ver todas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
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
        ventasDiarias={diariasVentas}
        comprasDiarias={diariasCompras}
        comprasPorProveedor={porProveedor}
        ventasPorMedioPago={porMedioPago}
        topProductosVendidos={topProductos}
        desde={desde.toISOString().slice(0, 10)}
        hasta={hasta.toISOString().slice(0, 10)}
      />
    </div>
  );
}
