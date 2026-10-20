import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError } from "@/lib/errores-dominio";

function mensajeNoEliminable(ventas: number, movimientos: number): string {
  const partes: string[] = [];
  if (ventas > 0) partes.push(`${ventas} venta${ventas === 1 ? "" : "s"}`);
  if (movimientos > 0) partes.push(`${movimientos} movimiento${movimientos === 1 ? "" : "s"} de cuenta corriente`);
  return `No se puede eliminar: el cliente tiene ${partes.join(" y ")}. Desactivalo para que no aparezca al vender.`;
}

// Eliminación DEFINITIVA de un cliente, solo si no tiene nada asociado: ni
// ventas (en cualquier estado, incluso anuladas) ni movimientos de cuenta
// corriente. Un cliente con historial no se borra — se desactiva — porque
// el libro de ventas y la cuenta corriente son registros contables que
// tienen que seguir explicándose. La base lo respalda con FK (RESTRICT):
// aunque llegue una venta entre el chequeo y el borrado, el DELETE falla.
export async function eliminarCliente(ferreteriaId: string, clienteId: string, usuarioId: string) {
  const cliente = await prisma.$transaction(async (tx) => {
    const encontrado = await tx.cliente.findUnique({
      where: { id_ferreteriaId: { id: clienteId, ferreteriaId } },
      select: { id: true, nombre: true, rut: true, _count: { select: { ventas: true, cuentaCliente: true } } },
    });
    if (!encontrado) throw new EntidadNoEncontradaError("Cliente no encontrado.");

    const { ventas, cuentaCliente } = encontrado._count;
    if (ventas > 0 || cuentaCliente > 0) throw new EstadoInvalidoError(mensajeNoEliminable(ventas, cuentaCliente));

    await tx.cliente.delete({ where: { id_ferreteriaId: { id: clienteId, ferreteriaId } } });
    return encontrado;
  }).catch((error) => {
    // FK RESTRICT: apareció una venta/movimiento justo antes del borrado.
    if (error instanceof Error && "code" in error && error.code === "P2003") {
      throw new EstadoInvalidoError("No se puede eliminar: el cliente acaba de recibir movimientos. Desactivalo para que no aparezca al vender.");
    }
    throw error;
  });

  await auditar({
    accion: "CLIENTE_ELIMINA",
    usuarioId,
    ferreteriaId,
    entidad: "Cliente",
    entidadId: cliente.id,
    detalle: { nombre: cliente.nombre, rut: cliente.rut },
  });
}
