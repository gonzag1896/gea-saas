"use client";

import { useEffect, useState } from "react";

type ClienteConSaldo = { id: string; nombre: string; telefono: string | null; saldo: number };

export default function CuentaCorrientePage() {
  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);

  useEffect(() => {
    fetch("/api/cuenta-corriente").then(async (res) => {
      if (res.ok) setClientes((await res.json()).clientes);
    });
  }, []);

  return (
    <main>
      <h1>Cuenta Corriente</h1>
      <table>
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Saldo</th><th></th></tr></thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td>
              <td>{c.telefono ?? "—"}</td>
              <td style={{ color: c.saldo > 0 ? "crimson" : undefined }}>{c.saldo.toFixed(2)}</td>
              <td><a href={`/clientes/${c.id}`}>Ver detalle</a></td>
            </tr>
          ))}
        </tbody>
      </table>
      {clientes.length === 0 && <p>Todavía no hay clientes cargados.</p>}
    </main>
  );
}
