import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { CategoriasClient } from "./CategoriasClient";

export default async function CategoriasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const categorias = await prisma.categoria.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });

  return <CategoriasClient categoriasIniciales={categorias} />;
}
