"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
    <main className="flex min-h-screen flex-col justify-center gap-6 p-10">
      <h1 className="text-xl font-semibold text-foreground">Recuperar contraseña</h1>
      {mensaje ? (
        <p className="text-sm text-foreground">{mensaje}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex max-w-xs flex-col gap-4">
          <FormField label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </FormField>
          <Button type="submit" loading={enviando}>
            {enviando ? "Enviando…" : "Enviar instrucciones"}
          </Button>
        </form>
      )}
      <p><a href="/login" className="text-sm text-primary underline underline-offset-2">Volver a ingresar</a></p>
    </main>
  );
}
