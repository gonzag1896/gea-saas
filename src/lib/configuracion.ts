import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";

export async function obtenerCotizacionDolar(ferreteriaId: string) {
  const ferreteria = await prisma.ferreteria.findUniqueOrThrow({
    where: { id: ferreteriaId },
    select: { cotizacionDolar: true, cotizacionDolarFecha: true },
  });
  return {
    cotizacionDolar: ferreteria.cotizacionDolar ? ferreteria.cotizacionDolar.toString() : null,
    cotizacionDolarFecha: ferreteria.cotizacionDolarFecha,
  };
}

// Guardado explícito, nunca automático: el Dueño consulta el BCU (o
// escribe un valor a mano) y confirma — así ningún total ya calculado
// cambia de golpe por una cotización que se actualizó sola en segundo
// plano.
export async function actualizarCotizacionDolar(ferreteriaId: string, valor: number, usuarioId: string) {
  await prisma.ferreteria.update({
    where: { id: ferreteriaId },
    data: { cotizacionDolar: valor, cotizacionDolarFecha: new Date() },
  });

  await auditar({
    accion: "COTIZACION_DOLAR_ACTUALIZA",
    usuarioId,
    ferreteriaId,
    entidad: "Ferreteria",
    entidadId: ferreteriaId,
    detalle: { valor },
  });
}
