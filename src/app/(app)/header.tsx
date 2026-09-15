"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, History, Repeat, LogOut, ShieldCheck } from "lucide-react";
import type { RolFerreteria } from "@prisma/client";
import { tienePermiso } from "@/lib/permisos";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/Dropdown";
import { Badge } from "@/components/ui/Badge";
import { cerrarSesion } from "./actions";

const ETIQUETA_ROL: Record<RolFerreteria, string> = {
  DUENO: "Dueño",
  CAJERO: "Cajero",
  DEPOSITO: "Depósito",
};

function iniciales(email: string) {
  return email.slice(0, 2).toUpperCase();
}

// Barra superior: identidad (ferretería activa) a la izquierda, cuenta del
// usuario a la derecha en un único menú — reemplaza el bloque de texto
// suelto + botones que vivía antes en el sidebar (spec: "no mostrar estos
// elementos como texto plano pegado").
export function Header({
  email,
  ferreteriaId,
  ferreteriaNombre,
  rol,
  soporte,
  isSuperAdmin,
}: {
  email: string;
  ferreteriaId: string | null;
  ferreteriaNombre: string | null | undefined;
  rol: RolFerreteria | null | undefined;
  soporte: boolean;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();

  async function cambiarFerreteria() {
    if (soporte) {
      await update({ salirDeSoporte: true });
    }
    router.push("/seleccionar-ferreteria");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-2">
        {ferreteriaId && (
          <>
            {soporte && (
              <Badge variant="warning" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Modo soporte
              </Badge>
            )}
            <span className="text-sm font-medium text-foreground">{ferreteriaNombre}</span>
            {rol && <Badge variant="neutral">{ETIQUETA_ROL[rol]}</Badge>}
          </>
        )}
      </div>

      <Dropdown
        trigger={
          <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {iniciales(email)}
            </span>
            <span className="max-w-[180px] truncate">{email}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        }
      >
        <DropdownLabel>{email}</DropdownLabel>
        <DropdownSeparator />
        {!isSuperAdmin && (
          <DropdownItem onClick={cambiarFerreteria}>
            <Repeat className="h-4 w-4" /> Cambiar de ferretería
          </DropdownItem>
        )}
        {soporte && (
          <DropdownItem onClick={cambiarFerreteria}>
            <Repeat className="h-4 w-4" /> Salir de modo soporte
          </DropdownItem>
        )}
        {rol && tienePermiso(rol, "auditoria", "ver") && (
          <DropdownItem onClick={() => router.push("/auditoria")}>
            <History className="h-4 w-4" /> Auditoría
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem onClick={() => cerrarSesion()} className="text-danger hover:bg-danger/10">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </DropdownItem>
      </Dropdown>
    </header>
  );
}
