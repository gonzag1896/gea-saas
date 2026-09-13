"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Cliente = { id: string; nombre: string; telefono: string | null };

export default function ClientesPage() {
  const { data: session } = useSession();
  const puedeModificar = !!session?.user.rol && tienePermiso(session.user.rol, "clientes", "modificar");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/clientes");
    if (res.ok) setClientes((await res.json()).clientes);
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, telefono: telefono || undefined }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    setTelefono("");
    cargar();
  }

  async function editar(cliente: Cliente) {
    const nuevoNombre = prompt("Nombre", cliente.nombre);
    if (nuevoNombre === null) return;
    const nuevoTelefono = prompt("Teléfono", cliente.telefono ?? "");
    await fetch(`/api/clientes/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre, telefono: nuevoTelefono || undefined }),
    });
    cargar();
  }

  return (
    <main>
      <h1>Clientes</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead><tr><th>Nombre</th><th>Teléfono</th>{puedeModificar && <th></th>}</tr></thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td>
              <td>{c.telefono ?? "—"}</td>
              {puedeModificar && <td><button onClick={() => editar(c)}>Editar</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
