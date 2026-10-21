import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError } from "@/lib/errores-dominio";
import { calcularSaldoCliente } from "@/lib/cuenta-corriente";

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

// ---------------------------------------------------------------------------
// Unir clientes duplicados
// ---------------------------------------------------------------------------

const CAMPOS_COPIABLES = [
  ["rut", "RUT"],
  ["telefono", "teléfono"],
  ["email", "email"],
  ["direccion", "dirección"],
  ["ciudad", "ciudad"],
] as const;

type DatosContacto = { rut: string | null; telefono: string | null; email: string | null; direccion: string | null; ciudad: string | null };

// Campos de contacto que el cliente a conservar tiene vacíos y el duplicado sí
// tiene: se completan al unir, para no perder el dato. Lo que el cliente a
// conservar ya tiene, nunca se pisa (tampoco su lista de precios).
function camposACopiar(origen: DatosContacto, destino: DatosContacto) {
  return CAMPOS_COPIABLES.filter(([campo]) => !destino[campo] && origen[campo]);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function cargarParaUnir(ferreteriaId: string, origenId: string, destinoId: string) {
  if (origenId === destinoId) throw new EstadoInvalidoError("Elegí un cliente distinto al duplicado.");
  const select = { id: true, nombre: true, rut: true, telefono: true, email: true, direccion: true, ciudad: true } as const;
  const [origen, destino] = await Promise.all([
    prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: origenId, ferreteriaId } }, select }),
    prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: destinoId, ferreteriaId } }, select }),
  ]);
  if (!origen) throw new EntidadNoEncontradaError("Cliente no encontrado.");
  if (!destino) throw new EntidadNoEncontradaError("El cliente a conservar no existe.");
  return { origen, destino };
}

// Lo que va a pasar si se unen, sin tocar nada: cuántas ventas y movimientos
// se mueven y cómo queda el saldo (pesos y dólares por separado).
export async function vistaPreviaUnionClientes(ferreteriaId: string, origenId: string, destinoId: string) {
  const { origen, destino } = await cargarParaUnir(ferreteriaId, origenId, destinoId);
  const [ventas, movimientos, saldoOrigen, saldoDestino] = await Promise.all([
    prisma.venta.count({ where: { ferreteriaId, clienteId: origenId } }),
    prisma.cuentaCliente.count({ where: { ferreteriaId, clienteId: origenId } }),
    calcularSaldoCliente(ferreteriaId, origenId),
    calcularSaldoCliente(ferreteriaId, destinoId),
  ]);
  return {
    origen: { id: origen.id, nombre: origen.nombre, ventas, movimientos, ...saldoOrigen },
    destino: { id: destino.id, nombre: destino.nombre, ...saldoDestino },
    destinoDespues: {
      saldoUYU: r2(saldoOrigen.saldoUYU + saldoDestino.saldoUYU),
      saldoUSD: r2(saldoOrigen.saldoUSD + saldoDestino.saldoUSD),
    },
    camposACopiar: camposACopiar(origen, destino).map(([, etiqueta]) => etiqueta),
  };
}

// Une un cliente duplicado con el que se conserva: todas sus ventas y
// movimientos de cuenta corriente pasan al cliente que queda (su saldo es la
// suma de los dos) y el duplicado se elimina. Es una sola transacción: o pasa
// todo o no pasa nada. No se pierde ningún registro, por eso las ventas, el
// stock y la cuenta corriente siguen cuadrando.
export async function unirClientes(ferreteriaId: string, origenId: string, destinoId: string, usuarioId: string) {
  const { origen, destino } = await cargarParaUnir(ferreteriaId, origenId, destinoId);
  const saldoOrigen = await calcularSaldoCliente(ferreteriaId, origenId);

  const resultado = await prisma.$transaction(async (tx) => {
    const ventas = await tx.venta.updateMany({ where: { ferreteriaId, clienteId: origenId }, data: { clienteId: destinoId } });
    const movimientos = await tx.cuentaCliente.updateMany({ where: { ferreteriaId, clienteId: origenId }, data: { clienteId: destinoId } });
    // El duplicado se borra ANTES de completar el RUT del que queda: el RUT es
    // único por ferretería y mientras exista el duplicado chocaría.
    await tx.cliente.delete({ where: { id_ferreteriaId: { id: origenId, ferreteriaId } } });

    const copiar = camposACopiar(origen, destino);
    if (copiar.length > 0) {
      await tx.cliente.update({
        where: { id_ferreteriaId: { id: destinoId, ferreteriaId } },
        data: Object.fromEntries(copiar.map(([campo]) => [campo, origen[campo]])),
      });
    }
    return { ventas: ventas.count, movimientos: movimientos.count, copiados: copiar.map(([, etiqueta]) => etiqueta) };
  }).catch((error) => {
    // FK RESTRICT: entró una venta o movimiento del duplicado a mitad de la unión.
    if (error instanceof Error && "code" in error && error.code === "P2003") {
      throw new EstadoInvalidoError("El duplicado recibió movimientos mientras se unía. No se cambió nada: probá de nuevo.");
    }
    throw error;
  });

  await auditar({
    accion: "CLIENTE_UNE",
    usuarioId,
    ferreteriaId,
    entidad: "Cliente",
    entidadId: destinoId,
    detalle: {
      duplicadoId: origen.id,
      duplicadoNombre: origen.nombre,
      duplicadoRut: origen.rut,
      conservadoNombre: destino.nombre,
      ventasMovidas: resultado.ventas,
      movimientosMovidos: resultado.movimientos,
      saldoDuplicado: saldoOrigen,
      camposCompletados: resultado.copiados,
    },
  });

  return resultado;
}
