import { redirect } from "next/navigation";
import { obtenerSesionValidada } from "@/lib/tenant";
import { MiCuentaClient } from "./MiCuentaClient";

export default async function MiCuentaPage() {
  const session = await obtenerSesionValidada();
  if (!session?.user) redirect("/login");

  return <MiCuentaClient email={session.user.email ?? ""} />;
}
