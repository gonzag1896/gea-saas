import { z } from "zod";

export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
});
export const modificarCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

export const crearSubCategoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  categoriaId: z.string().min(1, "La categoría es obligatoria."),
});
export const modificarSubCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  categoriaId: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

export const crearMarcaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
});
export const modificarMarcaSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

// stockActual queda afuera a propósito: el stock inicial se carga como un
// ajuste (Fase 9), nunca como un campo editable del catálogo — si se
// pudiera escribir acá, dejaría de ser cierto que MovimientoStock es la
// única fuente de verdad del stock (ver prisma/schema.prisma).
export const crearProductoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio."),
  descripcion: z.string().min(1, "La descripción es obligatoria."),
  subCategoriaId: z.string().min(1, "La sub categoría es obligatoria."),
  marcaId: z.string().min(1, "La marca es obligatoria."),
  moneda: z.enum(["UYU", "USD"]).optional(),
  precioCosto: z.number().nonnegative().optional(),
  precioVenta: z.number().nonnegative().optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  observaciones: z.string().optional(),
});

// Separado en dos: cambiar precio es un evento auditado y un permiso
// distinto (módulo "precios", exclusivo de Dueño) de modificar el resto
// del catálogo (módulo "productos", que Depósito también tiene).
export const modificarProductoGeneralSchema = z.object({
  descripcion: z.string().min(1).optional(),
  subCategoriaId: z.string().min(1).optional(),
  marcaId: z.string().min(1).optional(),
  moneda: z.enum(["UYU", "USD"]).optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  observaciones: z.string().optional(),
  activo: z.boolean().optional(),
});
export const modificarProductoPrecioSchema = z.object({
  precioCosto: z.number().nonnegative().optional(),
  precioVenta: z.number().nonnegative().optional(),
});

export const crearClienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  telefono: z.string().optional(),
});
// Sin "activo": la matriz de permisos (Revisión técnica final, sección 6)
// no le da acción "eliminar" a ningún rol sobre Clientes — a diferencia de
// Productos/Usuarios, acá no se aprobó una baja lógica.
export const modificarClienteSchema = z.object({
  nombre: z.string().min(1).optional(),
  telefono: z.string().optional(),
});

export const crearProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  rut: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
// Mismo motivo que Cliente: sin "activo", la matriz no aprobó baja lógica
// para Proveedores.
export const modificarProveedorSchema = z.object({
  nombre: z.string().min(1).optional(),
  rut: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
