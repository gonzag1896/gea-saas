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
  codigoBarras: z.string().optional(),
  descripcion: z.string().min(1, "La descripción es obligatoria."),
  subCategoriaId: z.string().min(1, "La familia es obligatoria."),
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
  codigoBarras: z.string().optional(),
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
  listaPrecioId: z.string().optional(),
});
export const modificarClienteSchema = z.object({
  nombre: z.string().min(1).optional(),
  telefono: z.string().optional(),
  listaPrecioId: z.string().optional(),
  activo: z.boolean().optional(),
});

export const crearListaPrecioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
});
export const modificarListaPrecioSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

// Un precio por lista para un producto — null en el mapa borra el
// override (vuelve a usar el precio base). No confundir con
// modificarProductoPrecioSchema: ese es el precio base, este el de una
// lista puntual, y viven en endpoints separados a propósito.
export const guardarPreciosListaSchema = z.object({
  precios: z.record(z.string(), z.number().nonnegative().nullable()),
});

export const crearProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  rut: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
export const modificarProveedorSchema = z.object({
  nombre: z.string().min(1).optional(),
  rut: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  activo: z.boolean().optional(),
});
