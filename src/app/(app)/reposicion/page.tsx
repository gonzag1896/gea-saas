import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { sugerirReposicion } from "@/lib/reposicion";
import { ReposicionClient } from "./ReposicionClient";

export default async function ReposicionPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const sugerencias = await sugerirReposicion(contexto.ferreteriaId);
  return <ReposicionClient sugerencias={sugerencias} />;
}
