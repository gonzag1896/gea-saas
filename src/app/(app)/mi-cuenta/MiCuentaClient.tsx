"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cerrarSesion } from "../actions";

export function MiCuentaClient({ email }: { email: string }) {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (passwordNueva !== confirmar) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setGuardando(true);
    const res = await fetch("/api/auth/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordActual, passwordNueva }),
    });
    setGuardando(false);

    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Mi cuenta" />
        <Alert variant="success">
          Contraseña actualizada. Por seguridad, cerramos tu sesión — iniciá sesión de nuevo con la contraseña nueva.
        </Alert>
        <div>
          <form action={cerrarSesion}>
            <Button type="submit">Ir a iniciar sesión</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mi cuenta" description={email} />

      <Card className="max-w-md">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Cambiar contraseña</h3>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Contraseña actual" required>
            <Input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} required autoFocus />
          </FormField>
          <FormField label="Contraseña nueva (mínimo 10 caracteres)" required>
            <Input type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} minLength={10} required />
          </FormField>
          <FormField label="Repetir contraseña nueva" required>
            <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} minLength={10} required />
          </FormField>

          {error && <Alert>{error}</Alert>}

          <div>
            <Button type="submit" loading={guardando}>Guardar contraseña</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
