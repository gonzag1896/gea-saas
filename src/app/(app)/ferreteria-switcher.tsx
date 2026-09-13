"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function FerreteriaSwitcher({ isSuperAdmin, soporte }: { isSuperAdmin: boolean; soporte: boolean }) {
  const { update } = useSession();
  const router = useRouter();

  if (soporte) {
    return (
      <button
        onClick={async () => {
          await update({ salirDeSoporte: true });
          router.push("/seleccionar-ferreteria");
          router.refresh();
        }}
      >
        Salir de modo soporte
      </button>
    );
  }

  if (isSuperAdmin) return null;

  return <a href="/seleccionar-ferreteria">Cambiar de ferretería</a>;
}
