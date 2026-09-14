"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function FerreteriaSwitcher({ isSuperAdmin, soporte }: { isSuperAdmin: boolean; soporte: boolean }) {
  const { update } = useSession();
  const router = useRouter();

  if (soporte) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          await update({ salirDeSoporte: true });
          router.push("/seleccionar-ferreteria");
          router.refresh();
        }}
      >
        Salir de modo soporte
      </Button>
    );
  }

  if (isSuperAdmin) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => router.push("/seleccionar-ferreteria")}>
      Cambiar de ferretería
    </Button>
  );
}
