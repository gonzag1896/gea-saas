"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MEDIO_PAGO_LABEL: Record<string, string> = { CONTADO: "Contado", CREDITO: "Crédito", TRANSFERENCIA: "Transferencia" };
const MEDIO_PAGO_COLOR: Record<string, string> = { CONTADO: "#16a34a", CREDITO: "#ea580c", TRANSFERENCIA: "#2563eb" };

// Único pedazo cliente del dashboard: Recharts necesita el navegador, y el
// selector de rango dispara una navegación con ?desde=&hasta= — el Server
// Component de page.tsx vuelve a correr con esos params y manda datos
// frescos ya renderizados, sin que este componente le pida nada aparte a
// una API route.
export function DashboardCharts({
  ventasDiarias,
  comprasDiarias,
  comprasPorProveedor,
  ventasPorMedioPago,
  topProductosVendidos,
  desde: desdeInicial,
  hasta: hastaInicial,
}: {
  ventasDiarias: { fecha: string; total: number }[] | null;
  comprasDiarias: { fecha: string; total: number }[] | null;
  comprasPorProveedor: { proveedor: string; total: number }[] | null;
  ventasPorMedioPago: { medioPago: string; total: number }[] | null;
  topProductosVendidos: { producto: string; cantidad: number; total: number }[] | null;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);

  function aplicar() {
    router.push(`/dashboard?desde=${desde}&hasta=${hasta}`);
  }

  const ventasVsCompras = useMemo(() => {
    if (ventasDiarias === null && comprasDiarias === null) return null;
    const fechas = new Set<string>();
    (ventasDiarias ?? []).forEach((v) => fechas.add(v.fecha));
    (comprasDiarias ?? []).forEach((c) => fechas.add(c.fecha));
    const ventasPorFecha = new Map((ventasDiarias ?? []).map((v) => [v.fecha, v.total]));
    const comprasPorFecha = new Map((comprasDiarias ?? []).map((c) => [c.fecha, c.total]));
    return Array.from(fechas)
      .sort()
      .map((fecha) => ({
        fecha,
        ventas: ventasPorFecha.get(fecha) ?? 0,
        compras: comprasPorFecha.get(fecha) ?? 0,
      }));
  }, [ventasDiarias, comprasDiarias]);

  const totalMedioPago = (ventasPorMedioPago ?? []).reduce((acc, m) => acc + m.total, 0);

  return (
    <>
      {(ventasDiarias !== null || comprasPorProveedor !== null) && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Desde</span>
            <DatePicker value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Hasta</span>
            <DatePicker value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <Button variant="secondary" onClick={aplicar}>Aplicar</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ventasVsCompras !== null && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground">Ventas vs. Compras</h3>
            <p className="mb-3 text-xs text-muted-foreground">Tendencia diaria del período — si la línea verde queda debajo de la naranja, el margen del período fue negativo.</p>
            {ventasVsCompras.length === 0 ? (
              <EmptyState message="No hay ventas ni compras confirmadas en este rango de fechas." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ventasVsCompras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="fecha" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                  <Legend formatter={(v) => (v === "ventas" ? "Ventas" : "Compras")} />
                  <Line type="monotone" dataKey="ventas" name="ventas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="compras" name="compras" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}

        {topProductosVendidos !== null && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground">Productos más vendidos</h3>
            <p className="mb-3 text-xs text-muted-foreground">Los que más plata generaron en el período — guía para priorizar reposición.</p>
            {topProductosVendidos.length === 0 ? (
              <EmptyState message="No hay ventas confirmadas en este rango de fechas." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProductosVendidos} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis type="category" dataKey="producto" stroke="var(--color-muted-foreground)" fontSize={11} width={110} tick={{ width: 100 }} />
                  <Tooltip
                    formatter={(value: number, _name, entry: { payload?: { cantidad: number } }) => [`$ ${formatoMoneda(value)} · ${entry.payload?.cantidad} u.`, "Vendido"]}
                  />
                  <Bar dataKey="total" name="Total" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}

        {ventasPorMedioPago !== null && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground">Ventas por medio de pago</h3>
            <p className="mb-3 text-xs text-muted-foreground">Cuánto de lo vendido ya entró como caja (Contado/Transferencia) vs. queda como promesa de pago (Crédito).</p>
            {ventasPorMedioPago.length === 0 ? (
              <EmptyState message="No hay ventas confirmadas en este rango de fechas." />
            ) : (
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <ResponsiveContainer width="100%" height={220} className="sm:flex-1">
                  <PieChart>
                    <Pie
                      data={ventasPorMedioPago}
                      dataKey="total"
                      nameKey="medioPago"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {ventasPorMedioPago.map((m) => (
                        <Cell key={m.medioPago} fill={MEDIO_PAGO_COLOR[m.medioPago] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 sm:w-40">
                  {ventasPorMedioPago.map((m) => (
                    <div key={m.medioPago} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MEDIO_PAGO_COLOR[m.medioPago] ?? "#94a3b8" }} />
                        {MEDIO_PAGO_LABEL[m.medioPago] ?? m.medioPago}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {totalMedioPago > 0 ? Math.round((m.total / totalMedioPago) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {comprasPorProveedor !== null && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground">Compras por proveedor</h3>
            <p className="mb-3 text-xs text-muted-foreground">A quién le compraste más en el período — útil para negociar precios o condiciones.</p>
            {comprasPorProveedor.length === 0 ? (
              <EmptyState message="No hay compras confirmadas en este rango de fechas." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={comprasPorProveedor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="proveedor" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                  <Bar dataKey="total" name="Total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
