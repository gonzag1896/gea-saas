"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Proveedor = { id: string; nombre: string; rut: string | null; telefono: string | null; email: string | null };

export default function ProveedoresPage() {
  const { data: session } = useSession();
  const puedeModificar = !!session?.user.rol && tienePermiso(session.user.rol, "proveedores", "modificar");

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState({ nombre: "", rut: "", telefono: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/proveedores");
    if (res.ok) setProveedores((await res.json()).proveedores);
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: form.nombre, rut: form.rut || undefined, telefono: form.telefono || undefined, email: form.email || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setForm({ nombre: "", rut: "", telefono: "", email: "" });
    cargar();
  }

  async function editar(proveedor: Proveedor) {
    const nombre = prompt("Nombre", proveedor.nombre);
    if (nombre === null) return;
    const telefono = prompt("Teléfono", proveedor.telefono ?? "");
    const email = prompt("Email", proveedor.email ?? "");
    const res = await fetch(`/api/proveedores/${proveedor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono: telefono || undefined, email: email || undefined }),
    });
    if (!res.ok) setError((await res.json()).error);
    cargar();
  }

  return (
    <main>
      <h1>Proveedores</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" required />
        <input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="RUT" />
        <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead><tr><th>Nombre</th><th>RUT</th><th>Teléfono</th><th>Email</th>{puedeModificar && <th></th>}</tr></thead>
        <tbody>
          {proveedores.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.rut ?? "—"}</td>
              <td>{p.telefono ?? "—"}</td>
              <td>{p.email ?? "—"}</td>
              {puedeModificar && <td><button onClick={() => editar(p)}>Editar</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
