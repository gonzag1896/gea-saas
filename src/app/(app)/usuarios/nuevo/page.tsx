import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { UsuarioFormClient } from "../UsuarioFormClient";

export default async function NuevoUsuarioPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "usuarios", "crear")) redirect("/usuarios");

  return <UsuarioFormClient />;
}
