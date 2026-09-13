"use client";

import { useEffect, useState } from "react";

type Categoria = { id: string; nombre: string; activo: boolean };

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/categorias");
    if (res.ok) setCategorias((await res.json()).categorias);
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    cargar();
  }

  async function toggleActivo(categoria: Categoria) {
    await fetch(`/api/categorias/${categoria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !categoria.activo }),
    });
    cargar();
  }

  return (
    <main>
      <h1>Categorías</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td>
              <td>{c.activo ? "Activo" : "Inactivo"}</td>
              <td><button onClick={() => toggleActivo(c)}>{c.activo ? "Desactivar" : "Activar"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
