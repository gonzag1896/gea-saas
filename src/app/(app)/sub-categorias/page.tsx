"use client";

import { useEffect, useState } from "react";

type Categoria = { id: string; nombre: string };
type SubCategoria = { id: string; nombre: string; activo: boolean; categoriaId: string; categoria: { nombre: string } };

export default function SubCategoriasPage() {
  const [subCategorias, setSubCategorias] = useState<SubCategoria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resSub, resCat] = await Promise.all([fetch("/api/subcategorias"), fetch("/api/categorias")]);
    if (resSub.ok) setSubCategorias((await resSub.json()).subCategorias);
    if (resCat.ok) {
      const cats: Categoria[] = (await resCat.json()).categorias;
      setCategorias(cats);
      setCategoriaId((actual) => actual || cats[0]?.id || "");
    }
  }
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/subcategorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, categoriaId }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNombre("");
    cargar();
  }

  async function toggleActivo(sub: SubCategoria) {
    await fetch(`/api/subcategorias/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !sub.activo }),
    });
    cargar();
  }

  if (categorias.length === 0) {
    return (
      <main>
        <h1>Sub Categorías</h1>
        <p>Primero creá al menos una categoría.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Sub Categorías</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {subCategorias.map((s) => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>{s.categoria.nombre}</td>
              <td>{s.activo ? "Activo" : "Inactivo"}</td>
              <td><button onClick={() => toggleActivo(s)}>{s.activo ? "Desactivar" : "Activar"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
