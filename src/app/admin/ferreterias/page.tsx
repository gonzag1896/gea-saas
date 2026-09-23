import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarFerreterias } from "@/lib/ferreterias";
import { formatearFecha, diasHastaUruguay } from "@/lib/fecha";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

  // KPIs de cobranza: solo sobre ferreterías activas — una inactiva no es
  // "plata que se está por perder", ya se dio de baja a propósito.
  const activas = ferreterias.filter((f) => f.estado === "ACTIVO");
  const vencidas = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) < 0);
  const porVencer = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) >= 0 && diasHastaUruguay(f.vigenciaHasta) <= 7);
  const alDia = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) > 7);
  const sinPagos = activas.filter((f) => !f.vigenciaHasta);
  const ingresoMensualEstimado = activas.reduce((total, f) => total + (f.ultimoMonto ?? 0), 0);

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium text-muted-foreground">Vencidas</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{vencidas.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-muted-foreground">Vencen en ≤7 días</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{porVencer.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-muted-foreground">Al día</p>
          <p className="mt-1 text-2xl font-semibold text-success">{alDia.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-muted-foreground">Ingreso mensual estimado</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{ingresoMensualEstimado.toLocaleString("es-UY")}</p>
        </Card>
      </div>
      {sinPagos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {sinPagos.length} ferretería{sinPagos.length === 1 ? "" : "s"} activa{sinPagos.length === 1 ? "" : "s"} sin ningún pago registrado todavía (no entra{sinPagos.length === 1 ? "" : "n"} en los números de arriba).
        </p>
      )}

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
