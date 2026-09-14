"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoading } from "@/components/ui/PageLoading";

type DashboardData = {
  ventasDelMes: number | null;
  comprasDelMes: number | null;
  ventasDiarias: { fecha: string; total: number }[] | null;
  comprasPorProveedor: { proveedor: string; total: number }[] | null;
  desde: string;
  hasta: string;
};

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  async function cargar(desdeParam?: string, hastaParam?: string) {
    const params = new URLSearchParams();
    if (desdeParam) params.set("desde", desdeParam);
    if (hastaParam) params.set("hasta", hastaParam);
    const res = await fetch(`/api/dashboard?${params}`);
    if (res.ok) {
      const data: DashboardData = await res.json();
      setDatos(data);
      setDesde(data.desde);
      setHasta(data.hasta);
    }
  }
  useEffect(() => { cargar(); }, []);

  if (!datos) return <main><PageLoading /></main>;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={session?.user.ferreteriaNombre ?? undefined} />

      <div className="flex flex-wrap gap-4">
        {datos.ventasDelMes !== null && (
          <Card className="min-w-[200px]">
            <div className="text-sm text-muted-foreground">Ventas en el mes</div>
            <div className="text-2xl font-semibold text-foreground">$ {formatoMoneda(datos.ventasDelMes)}</div>
          </Card>
        )}
        {datos.comprasDelMes !== null && (
          <Card className="min-w-[200px]">
            <div className="text-sm text-muted-foreground">Compras en el mes</div>
            <div className="text-2xl font-semibold text-foreground">$ {formatoMoneda(datos.comprasDelMes)}</div>
          </Card>
        )}
      </div>

      {(datos.ventasDiarias !== null || datos.comprasPorProveedor !== null) && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Desde</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            <span className="mb-1 block font-medium">Hasta</span>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <Button variant="secondary" onClick={() => cargar(desde, hasta)}>Aplicar</Button>
        </div>
      )}

      {datos.ventasDiarias !== null && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Ventas diarias</h3>
          {datos.ventasDiarias.length === 0 ? (
            <EmptyState message="No hay ventas confirmadas en este rango de fechas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={datos.ventasDiarias}>
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

      {datos.comprasPorProveedor !== null && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Compras por proveedor</h3>
          {datos.comprasPorProveedor.length === 0 ? (
            <EmptyState message="No hay compras confirmadas en este rango de fechas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datos.comprasPorProveedor}>
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
    </main>
  );
}
