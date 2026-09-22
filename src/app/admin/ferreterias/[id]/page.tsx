import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listarPagosPlataforma } from "@/lib/ferreterias";
import { formatearFecha } from "@/lib/fecha";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegistrarPagoFormClient } from "./RegistrarPagoFormClient";

export default async function DetalleFerreteriaPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const ferreteria = await prisma.ferreteria.findUnique({ where: { id: params.id } });
  if (!ferreteria) notFound();

  const pagos = await listarPagosPlataforma(ferreteria.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title={ferreteria.nombre}
        description={ferreteria.vigenciaHasta
          ? `Vigencia de la mensualidad hasta el ${formatearFecha(ferreteria.vigenciaHasta)}.`
          : "Todavía no tiene ningún pago registrado."}
      />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Registrar pago</h3>
        <RegistrarPagoFormClient ferreteriaId={ferreteria.id} />
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de pagos</h3>
        {pagos.length === 0 ? (
          <EmptyState message="Sin pagos registrados todavía." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-foreground">Fecha de pago</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Monto</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Vigencia extendida hasta</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Registrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-foreground">{formatearFecha(p.fecha)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.monto ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatearFecha(p.vigenciaHasta)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.registradoPorNombre ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link href="/admin/ferreterias" className="text-sm text-primary underline underline-offset-2">
        ← Volver a Ferreterías
      </Link>
    </main>
  );
}
