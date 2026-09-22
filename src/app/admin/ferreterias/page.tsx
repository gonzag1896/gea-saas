import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarFerreterias } from "@/lib/ferreterias";
import { formatearFecha, diasHastaUruguay } from "@/lib/fecha";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

// Colores del aviso de vigencia: vencida (o hoy) en rojo, a 7 días o
// menos en naranja (mismo umbral visual que "por vencer" en otras partes
// del sistema), el resto en gris neutro. El aviso de 3 días al Dueño
// (Header) es un umbral distinto y más estricto — acá es solo para que el
// Super Admin priorice a quién cobrarle primero.
function colorVigencia(vigenciaHasta: Date | null): string {
  if (!vigenciaHasta) return "text-muted-foreground";
  const dias = diasHastaUruguay(vigenciaHasta);
  if (dias < 0) return "text-danger font-medium";
  if (dias <= 7) return "text-warning font-medium";
  return "text-foreground";
}

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
                <th className="px-4 py-3 font-semibold text-foreground">Usuarios activos</th>
                <th className="px-4 py-3 font-semibold text-foreground">Productos</th>
                <th className="px-4 py-3 font-semibold text-foreground">Estado</th>
                <th className="px-4 py-3 font-semibold text-foreground">Vigencia hasta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ferreterias.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/ferreterias/${f.id}`} className="font-medium text-primary hover:underline">
                      {f.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.cantidadUsuarios}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.cantidadProductos}</td>
                  <td className="px-4 py-3">
                    <span className={f.estado === "ACTIVO" ? "text-success" : "text-muted-foreground"}>
                      {f.estado === "ACTIVO" ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3", colorVigencia(f.vigenciaHasta))}>
                    {f.vigenciaHasta ? formatearFecha(f.vigenciaHasta) : "Sin pagos"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
