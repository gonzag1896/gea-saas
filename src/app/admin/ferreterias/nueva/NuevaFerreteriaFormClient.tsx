"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Store, UserRound, Eye, EyeOff, Wand2, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { FormField, FieldHint } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const ALFABETO_PASSWORD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generarPassword(largo = 14) {
  let resultado = "";
  for (let i = 0; i < largo; i++) {
    resultado += ALFABETO_PASSWORD[Math.floor(Math.random() * ALFABETO_PASSWORD.length)];
  }
  return resultado;
}

function SeccionCard({
  icon: Icon, titulo, children,
}: {
  icon: typeof Store; titulo: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function NuevaFerreteriaFormClient() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [duenoNombre, setDuenoNombre] = useState("");
  const [duenoEmail, setDuenoEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function generar() {
    setPassword(generarPassword());
    setVerPassword(true);
    setCopiado(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles — la contraseña ya está visible en el campo.
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/admin/ferreterias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, duenoNombre, duenoEmail, duenoPassword: password }),
    });
    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/admin/ferreterias");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/admin/ferreterias")}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Ferreterías
      </button>

      <PageHeader
        title="Nueva ferretería"
        description="Creás el tenant y su primer usuario (Dueño) en un solo paso."
      />

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <SeccionCard icon={Store} titulo="Datos de la ferretería">
          <FormField label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ferretería El Tornillo" required autoFocus />
          </FormField>
        </SeccionCard>

        <SeccionCard icon={UserRound} titulo="Primer usuario (Dueño)">
          <FormField label="Nombre" required>
            <Input value={duenoNombre} onChange={(e) => setDuenoNombre(e.target.value)} placeholder="Ej: María Rodríguez" required />
          </FormField>

          <FormField label="Email" required>
            <Input type="email" value={duenoEmail} onChange={(e) => setDuenoEmail(e.target.value)} placeholder="Ej: maria@gmail.com" required />
          </FormField>

          <FormField label="Contraseña temporal" required>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={10}
                  placeholder="Mínimo 10 caracteres"
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" onClick={generar} aria-label="Generar contraseña">
                <Wand2 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={copiar} disabled={!password} aria-label="Copiar contraseña">
                {copiado ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </FormField>
          <FieldHint>Se la das al dueño por fuera del sistema. Puede cambiarla después desde &quot;Mi cuenta&quot;.</FieldHint>
        </SeccionCard>

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" loading={guardando}>Crear ferretería</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/admin/ferreterias")}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
