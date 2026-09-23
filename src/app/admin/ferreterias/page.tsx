import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle2, Wallet, ChevronRight, Plus, Users, Package } from "lucide-react";
import { listarFerreterias } from "@/lib/ferreterias";
import { formatearFecha, diasHastaUruguay } from "@/lib/fecha";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? "") + (palabras[1]?.[0] ?? "")).toUpperCase();
}

// Mismo umbral que el aviso al Dueño para "por vencer" en la vista de
// cobranza — acá con matiz propio para que el Super Admin priorice a
// quién cobrarle primero (no es el mismo mensaje que ve el cliente).
function estadoVigencia(vigenciaHasta: Date | null): { label: string; variant: BadgeVariant } {
  if (!vigenciaHasta) return { label: "Sin pagos", variant: "neutral" };
  const dias = diasHastaUruguay(vigenciaHasta);
  if (dias < 0) return { label: "Vencida", variant: "danger" };
  if (dias <= 7) return { label: "Por vencer", variant: "warning" };
  return { label: "Al día", variant: "success" };
}

function KpiTile({
  icon: Icon, label, valor, tono,
}: {
  icon: typeof AlertTriangle; label: string; valor: string; tono: "danger" | "warning" | "success" | "primary";
}) {
  const tonos = {
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tonos[tono])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{valor}</p>
      </div>
    </div>
  );
}

export default async function AdminFerreteriasPage() {
  const ferreterias = await listarFerreterias();

  const activas = ferreterias.filter((f) => f.estado === "ACTIVO");
  const vencidas = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) < 0);
  const porVencer = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) >= 0 && diasHastaUruguay(f.vigenciaHasta) <= 7);
  const alDia = activas.filter((f) => f.vigenciaHasta && diasHastaUruguay(f.vigenciaHasta) > 7);
  const sinPagos = activas.filter((f) => !f.vigenciaHasta);
  const ingresoMensualEstimado = activas.reduce((total, f) => total + (f.ultimoMonto ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ferreterías"
        description="Alta de tenants nuevos y vista general de los existentes."
        action={
          <Link href="/admin/ferreterias/nueva">
            <Button>
              <Plus className="h-4 w-4" /> Nueva ferretería
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile icon={AlertTriangle} label="Vencidas" valor={String(vencidas.length)} tono="danger" />
        <KpiTile icon={Clock} label="Vencen en ≤7 días" valor={String(porVencer.length)} tono="warning" />
        <KpiTile icon={CheckCircle2} label="Al día" valor={String(alDia.length)} tono="success" />
        <KpiTile icon={Wallet} label="Ingreso mensual est." valor={ingresoMensualEstimado.toLocaleString("es-UY")} tono="primary" />
      </div>

      {sinPagos.length > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {sinPagos.length} ferretería{sinPagos.length === 1 ? "" : "s"} activa{sinPagos.length === 1 ? "" : "s"} sin ningún pago registrado todavía (no entra{sinPagos.length === 1 ? "" : "n"} en los números de arriba).
        </p>
      )}

      {ferreterias.length === 0 ? (
        <EmptyState message="Todavía no hay ninguna ferretería creada." />
      ) : (
        <div className="flex flex-col gap-2">
          {ferreterias.map((f) => {
            const vigencia = estadoVigencia(f.vigenciaHasta);
            return (
              <Link
                key={f.id}
                href={`/admin/ferreterias/${f.id}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {iniciales(f.nombre)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{f.nombre}</p>
                    {f.estado === "INACTIVO" && <Badge variant="neutral">Inactiva</Badge>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {f.cantidadUsuarios}</span>
                    <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {f.cantidadProductos}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <Badge variant={vigencia.variant}>{vigencia.label}</Badge>
                    {f.vigenciaHasta && (
                      <p className="mt-1 text-xs text-muted-foreground">hasta {formatearFecha(f.vigenciaHasta)}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
