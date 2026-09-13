"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function RestablecerPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const email = useSearchParams().get("email") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const res = await fetch("/api/auth/restablecer-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo restablecer la contraseña.");
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (ok) {
    return (
      <main style={{ padding: 40 }}>
        <p>Contraseña actualizada. Redirigiendo al ingreso…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Elegir nueva contraseña</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320 }}>
        <label>
          Nueva contraseña (mínimo 10 caracteres)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
            autoFocus
          />
        </label>
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </main>
  );
}
