import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, AlertTriangle, HelpCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { listarPagosPlataforma } from "@/lib/ferreterias";
import { formatearFecha, diasHastaUruguay } from "@/lib/fecha";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegistrarPagoFormClient } from "./RegistrarPagoFormClient";
import { PagosListClient } from "./PagosListClient";

function EstadoVigenciaHero({ vigenciaHasta }: { vigenciaHasta: Date | null }) {
  if (!vigenciaHasta) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <HelpCircle className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-foreground">Sin pagos registrados</p>
          <p className="text-sm text-muted-foreground">Todavía no tiene ninguna mensualidad cargada.</p>
        </div>
      </div>
    );
  }

  const dias = diasHastaUruguay(vigenciaHasta);
  const vencida = dias < 0;
  const porVencer = dias >= 0 && dias <= 7;
  const tono = vencida ? "danger" : porVencer ? "warning" : "success";
  const Icon = vencida ? AlertTriangle : CalendarCheck;

  const mensaje = vencida
    ? `Venció el ${formatearFecha(vigenciaHasta)}`
    : dias === 0
      ? `Vence hoy (${formatearFecha(vigenciaHasta)})`
      : `Vigente hasta el ${formatearFecha(vigenciaHasta)} · ${dias} día${dias === 1 ? "" : "s"}`;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border p-5",
      tono === "danger" && "border-danger/20 bg-danger/10",
      tono === "warning" && "border-warning/20 bg-warning/10",
      tono === "success" && "border-success/20 bg-success/10",
    )}>
      <span className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        tono === "danger" && "bg-danger/15 text-danger",
        tono === "warning" && "bg-warning/15 text-warning",
        tono === "success" && "bg-success/15 text-success",
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={cn(
        "font-medium",
        tono === "danger" && "text-danger",
        tono === "warning" && "text-warning",
        tono === "success" && "text-success",
      )}>
        {mensaje}
      </p>
    </div>
  );
}

export default async function DetalleFerreteriaPage({ params }: { params: { id: string } }) {
  const ferreteria = await prisma.ferreteria.findUnique({ where: { id: params.id } });
  if (!ferreteria) notFound();

  const pagos = await listarPagosPlataforma(ferreteria.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/admin/ferreterias" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Ferreterías
      </Link>

      <PageHeader title={ferreteria.nombre} description="Mensualidad de la plataforma" />

      <EstadoVigenciaHero vigenciaHasta={ferreteria.vigenciaHasta} />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Registrar pago</h3>
        <RegistrarPagoFormClient ferreteriaId={ferreteria.id} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de pagos</h3>
        <PagosListClient
          ferreteriaId={ferreteria.id}
          pagos={pagos.map((p) => ({
            id: p.id,
            fecha: p.fecha.toISOString(),
            monto: p.monto,
            esGratis: p.esGratis,
            vigenciaDesde: p.vigenciaDesde.toISOString(),
            vigenciaHasta: p.vigenciaHasta.toISOString(),
            registradoPorNombre: p.registradoPorNombre,
          }))}
        />
      </div>
    </div>
  );
}
