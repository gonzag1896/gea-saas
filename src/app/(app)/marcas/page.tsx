"use client";

import { useEffect, useState } from "react";

type Marca = { id: string; nombre: string; activo: boolean };

export default function MarcasPage() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/marcas");
    if (res.ok) setMarcas((await res.json()).marcas);
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/marcas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    cargar();
  }

  async function toggleActivo(marca: Marca) {
    await fetch(`/api/marcas/${marca.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !marca.activo }),
    });
    cargar();
  }

  return (
    <main>
      <h1>Marcas</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {marcas.map((m) => (
            <tr key={m.id}>
              <td>{m.nombre}</td>
              <td>{m.activo ? "Activo" : "Inactivo"}</td>
              <td><button onClick={() => toggleActivo(m)}>{m.activo ? "Desactivar" : "Activar"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
