"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wand2, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField, FieldHint } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Rol = "DUENO" | "CAJERO" | "DEPOSITO";

const ETIQUETA_ROL: Record<Rol, string> = { DUENO: "Dueño", CAJERO: "Cajero", DEPOSITO: "Depósito" };
const DESCRIPCION_ROL: Record<Rol, string> = {
  DUENO: "Ve y hace todo: ventas, compras, precios, cuenta corriente y usuarios.",
  CAJERO: "Ventas, cobros y clientes — no ve compras ni precios de costo.",
  DEPOSITO: "Compras, stock y alta de productos — no ve plata de clientes.",
};

const ALFABETO_PASSWORD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generarPassword(largo = 12) {
  let resultado = "";
  for (let i = 0; i < largo; i++) {
    resultado += ALFABETO_PASSWORD[Math.floor(Math.random() * ALFABETO_PASSWORD.length)];
  }
  return resultado;
}

type UsuarioEditable = { id: string; nombre: string | null; email: string; rol: Rol };

export function UsuarioFormClient({ usuario }: { usuario?: UsuarioEditable }) {
  const router = useRouter();
  const esEdicion = !!usuario;
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? "CAJERO");
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
      // Sin permiso de portapapeles (http sin TLS, navegador viejo) — la
      // contraseña ya está visible en el campo, se puede copiar a mano.
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const res = esEdicion
      ? await fetch(`/api/usuarios/${usuario.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre,
            email,
            rol,
            ...(password ? { passwordNueva: password } : {}),
          }),
        })
      : await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, rol, password }),
        });

    setGuardando(false);
    if (!res.ok) return setError((await res.json()).error);
    router.push("/usuarios");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={esEdicion ? "Editar usuario" : "Nuevo usuario"}
        description={esEdicion
          ? "Cambiá nombre, email o rol. Dejá la contraseña en blanco si no querés cambiarla."
          : "Le pasás vos el email y la contraseña a la persona. Puede cambiarla después desde “Mi cuenta”."}
      />

      <Card className="max-w-lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <FormField label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: María Rodríguez" required />
          </FormField>

          <FormField label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ej: maria@gmail.com" required />
          </FormField>

          <FormField label="Rol" required>
            <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {Object.entries(ETIQUETA_ROL).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </Select>
          </FormField>
          <FieldHint>{DESCRIPCION_ROL[rol]}</FieldHint>

          <FormField label={esEdicion ? "Nueva contraseña (opcional)" : "Contraseña temporal"} required={!esEdicion}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={esEdicion ? undefined : 10}
                  pattern={esEdicion && password ? ".{10,}" : undefined}
                  title={esEdicion ? "Mínimo 10 caracteres" : undefined}
                  placeholder={esEdicion ? "Dejar en blanco para no cambiarla" : "Mínimo 10 caracteres"}
                  required={!esEdicion}
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
          <FieldHint>Se la das a la persona por fuera del sistema (de palabra, WhatsApp, etc.). No se envía ningún mail.</FieldHint>

          {error && <Alert>{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" loading={guardando}>{esEdicion ? "Guardar cambios" : "Crear usuario"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/usuarios")}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
