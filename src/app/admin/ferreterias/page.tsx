import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarFerreterias } from "@/lib/ferreterias";
import { formatearFecha } from "@/lib/fecha";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// Panel de administración de tenants: fuera de (app) a propósito (no hay
// ferretería activa acá, es de plataforma) — mismo criterio que
// /seleccionar-ferreteria. Solo entra un Super Admin.
export default async function AdminFerreteriasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const ferreterias = await listarFerreterias();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <PageHeader
        title="Ferreterías"
        description="Alta de tenants nuevos y vista general de los existentes."
        action={
          <Link href="/admin/ferreterias/nueva">
            <Button>Nueva ferretería</Button>
          </Link>
        }
      />

      {ferreterias.length === 0 ? (
        <EmptyState message="Todavía no hay ninguna ferretería creada." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-foreground">Nombre</th>
                <th className="px-4 py-3 font-semibold text-foreground">Slug</th>
                <th className="px-4 py-3 font-semibold text-foreground">Usuarios activos</th>
                <th className="px-4 py-3 font-semibold text-foreground">Productos</th>
                <th className="px-4 py-3 font-semibold text-foreground">Estado</th>
                <th className="px-4 py-3 font-semibold text-foreground">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ferreterias.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{f.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.slug ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.cantidadUsuarios}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.cantidadProductos}</td>
                  <td className="px-4 py-3">
                    <span className={f.estado === "ACTIVO" ? "text-success" : "text-muted-foreground"}>
                      {f.estado === "ACTIVO" ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatearFecha(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
