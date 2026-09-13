"use client";

import { useState } from "react";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const res = await fetch("/api/auth/recuperar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setEnviando(false);
    // Siempre el mismo mensaje, exista o no la cuenta.
    setMensaje(data.mensaje ?? "Si existe una cuenta con ese email, te enviamos instrucciones.");
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Recuperar contraseña</h1>
      {mensaje ? (
        <p>{mensaje}</p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <button type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar instrucciones"}
          </button>
        </form>
      )}
      <p><a href="/login">Volver a ingresar</a></p>
    </main>
  );
}
