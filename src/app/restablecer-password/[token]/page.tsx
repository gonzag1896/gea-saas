"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

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
      <main className="flex min-h-screen flex-col justify-center gap-6 p-10">
        <p className="text-sm text-foreground">Contraseña actualizada. Redirigiendo al ingreso…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center gap-6 p-10">
      <h1 className="text-xl font-semibold text-foreground">Elegir nueva contraseña</h1>
      <form onSubmit={onSubmit} className="flex max-w-xs flex-col gap-4">
        <FormField label="Nueva contraseña (mínimo 10 caracteres)">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
            autoFocus
          />
        </FormField>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={enviando}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </main>
  );
}
