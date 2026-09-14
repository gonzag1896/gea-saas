"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const resultado = await signIn("credentials", { email, password, redirect: false });

    setEnviando(false);
    if (resultado?.error) {
      // Mensaje único a propósito: no distingue email inexistente,
      // contraseña incorrecta o cuenta bloqueada.
      setError("Email o contraseña incorrectos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xs flex-col gap-4">
      <FormField label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </FormField>
      <FormField label="Contraseña">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </FormField>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" loading={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
      <a href="/recuperar-password" className="text-sm text-primary underline underline-offset-2">Olvidé mi contraseña</a>
    </form>
  );
}
