import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Nunca debe terminar en el log una contraseña ni un token, ni siquiera por
// un descuido de quien llama — se filtra acá, como red, además de la
// disciplina de cada caso de uso.
const CAMPOS_PROHIBIDOS = ["password", "passwordHash", "token", "secret"];

function limpiarDetalle(detalle?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!detalle) return undefined;
  const limpio = { ...detalle };
  for (const campo of CAMPOS_PROHIBIDOS) delete limpio[campo];
  return limpio;
}

export type AccionAuditoria =
  | "LOGIN_OK"
  | "LOGIN_FALLIDO"
  | "LOGOUT"
  | "PASSWORD_CAMBIO"
  | "PASSWORD_RESET_SOLICITADO"
  | "PASSWORD_RESET_COMPLETADO"
  | "IMPERSONACION_INICIO"
  | "IMPERSONACION_FIN"
  | "PRODUCTO_PRECIO_CAMBIO"
  | "COMPRA_CREA"
  | "COMPRA_CONFIRMA"
  | "COMPRA_ANULA"
  | "DEVOLUCION_COMPRA"
  | "VENTA_CREA"
  | "VENTA_CONFIRMA"
  | "VENTA_ANULA"
  | "DEVOLUCION_VENTA"
  | "STOCK_AJUSTE"
  | "COBRO_REGISTRA"
  | "PAGO_PROVEEDOR_REGISTRA"
  | "CAJA_CIERRE"
  | "CAJA_CIERRE_EDITA"
  | "COTIZACION_DOLAR_ACTUALIZA"
  | "CARGA_INICIAL_PRODUCTOS"
  | "FERRETERIA_CREA"
  | "USUARIO_CREA"
  | "USUARIO_DATOS_EDITA"
  | "USUARIO_ROL_CAMBIA"
  | "USUARIO_DESACTIVA"
  | "USUARIO_REACTIVA";

export async function auditar(params: {
  accion: AccionAuditoria;
  usuarioId?: string;
  ferreteriaId?: string;
  entidad?: string;
  entidadId?: string;
  detalle?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      accion: params.accion,
      usuarioId: params.usuarioId,
      ferreteriaId: params.ferreteriaId,
      entidad: params.entidad,
      entidadId: params.entidadId,
      detalle: limpiarDetalle(params.detalle) as Prisma.InputJsonValue | undefined,
      ip: params.ip,
      userAgent: params.userAgent,
    },
  });
}
