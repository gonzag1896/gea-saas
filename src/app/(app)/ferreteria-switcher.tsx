"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function FerreteriaSwitcher({ isSuperAdmin, soporte, className }: { isSuperAdmin: boolean; soporte: boolean; className?: string }) {
  const { update } = useSession();
  const router = useRouter();

  if (soporte) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={className}
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
    <Button variant="ghost" size="sm" className={className} onClick={() => router.push("/seleccionar-ferreteria")}>
      Cambiar de ferretería
    </Button>
  );
}
