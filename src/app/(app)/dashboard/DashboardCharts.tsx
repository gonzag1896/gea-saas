"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Único pedazo cliente del dashboard: Recharts necesita el navegador, y el
// selector de rango dispara una navegación con ?desde=&hasta= — el Server
// Component de page.tsx vuelve a correr con esos params y manda datos
// frescos ya renderizados, sin que este componente le pida nada aparte a
// una API route.
export function DashboardCharts({
  ventasDiarias,
  comprasPorProveedor,
  desde: desdeInicial,
  hasta: hastaInicial,
}: {
  ventasDiarias: { fecha: string; total: number }[] | null;
  comprasPorProveedor: { proveedor: string; total: number }[] | null;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);

  function aplicar() {
    router.push(`/dashboard?desde=${desde}&hasta=${hasta}`);
  }

  return (
    <>
      {(ventasDiarias !== null || comprasPorProveedor !== null) && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Desde</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Hasta</span>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <Button variant="secondary" onClick={aplicar}>Aplicar</Button>
        </div>
      )}

      {ventasDiarias !== null && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Ventas diarias</h3>
          {ventasDiarias.length === 0 ? (
            <EmptyState message="No hay ventas confirmadas en este rango de fechas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ventasDiarias}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="fecha" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                <Line type="monotone" dataKey="total" name="Total" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {comprasPorProveedor !== null && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Compras por proveedor</h3>
          {comprasPorProveedor.length === 0 ? (
            <EmptyState message="No hay compras confirmadas en este rango de fechas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comprasPorProveedor}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="proveedor" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                <Bar dataKey="total" name="Total" fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </>
  );
}
