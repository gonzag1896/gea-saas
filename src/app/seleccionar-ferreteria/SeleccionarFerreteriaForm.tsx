"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Item = { id: string; nombre: string; rol?: string };

export function SeleccionarFerreteriaForm({ items, modoSoporte }: { items: Item[]; modoSoporte: boolean }) {
  const { update } = useSession();
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);

  async function elegir(ferreteriaId: string) {
    setEnviando(ferreteriaId);
    await update(modoSoporte ? { soporteFerreteriaId: ferreteriaId } : { ferreteriaId });
    router.push("/dashboard");
    router.refresh();
  }

  if (items.length === 0) {
    return <p>No hay ferreterías {modoSoporte ? "" : "asignadas a tu usuario"} todavía.</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      {items.map((item) => (
        <li key={item.id}>
          <button onClick={() => elegir(item.id)} disabled={enviando !== null} style={{ width: "100%", textAlign: "left", padding: 12 }}>
            {item.nombre}
            {item.rol ? ` — ${item.rol}` : ""}
            {enviando === item.id ? " …" : ""}
          </button>
        </li>
      ))}
    </ul>
  );
}
