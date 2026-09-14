import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubCategoriasClient } from "./SubCategoriasClient";

export default async function SubCategoriasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const [subCategorias, categorias] = await Promise.all([
    prisma.subCategoria.findMany({
      where: { ferreteriaId: contexto.ferreteriaId },
      include: { categoria: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.categoria.findMany({ where: { ferreteriaId: contexto.ferreteriaId }, select: { id: true, nombre: true } }),
  ]);

  if (categorias.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Sub Categorías" />
        <EmptyState message="Primero creá al menos una categoría." />
      </div>
    );
  }

  return <SubCategoriasClient subCategoriasIniciales={subCategorias} categorias={categorias} />;
}
