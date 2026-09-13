"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

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

  if (!datos) return <div><p>Cargando…</p></div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{session?.user.ferreteriaNombre}</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {datos.ventasDelMes !== null && (
          <div style={{ border: "1px solid #ddd", padding: 16, minWidth: 200 }}>
            <div>Ventas en el mes</div>
            <div style={{ fontSize: 28, fontWeight: "bold" }}>$ {formatoMoneda(datos.ventasDelMes)}</div>
          </div>
        )}
        {datos.comprasDelMes !== null && (
          <div style={{ border: "1px solid #ddd", padding: 16, minWidth: 200 }}>
            <div>Compras en el mes</div>
            <div style={{ fontSize: 28, fontWeight: "bold" }}>$ {formatoMoneda(datos.comprasDelMes)}</div>
          </div>
        )}
      </div>

      {(datos.ventasDiarias !== null || datos.comprasPorProveedor !== null) && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <button onClick={() => cargar(desde, hasta)}>Aplicar</button>
        </div>
      )}

      {datos.ventasDiarias !== null && (
        <div style={{ marginBottom: 32 }}>
          <h3>Ventas diarias</h3>
          {datos.ventasDiarias.length === 0 ? (
            <p>No hay ventas confirmadas en este rango de fechas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={datos.ventasDiarias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#b5501f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {datos.comprasPorProveedor !== null && (
        <div>
          <h3>Compras por proveedor</h3>
          {datos.comprasPorProveedor.length === 0 ? (
            <p>No hay compras confirmadas en este rango de fechas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datos.comprasPorProveedor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="proveedor" />
                <YAxis />
                <Tooltip formatter={(v: number) => `$ ${formatoMoneda(v)}`} />
                <Bar dataKey="total" name="Total" fill="#34576e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
