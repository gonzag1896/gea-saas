import { prisma } from "@/lib/db";

// Categoría/Familia/Marca "pendiente de clasificar" — mismo cajón que ya
// usó la carga inicial del catálogo para lo que no se pudo clasificar
// (ver CARGA_INICIAL_PRODUCTOS). El alta rápida desde el punto de venta
// reutiliza esos mismos nombres en vez de inventar una convención nueva.
const CATEGORIA_PENDIENTE = "Otros";
const SUBCATEGORIA_PENDIENTE = "Sin clasificar";
const MARCA_PENDIENTE = "Sin marca (a revisar)";

async function obtenerSubCategoriaPendiente(ferreteriaId: string) {
  const categoria = await prisma.categoria.upsert({
    where: { ferreteriaId_nombre: { ferreteriaId, nombre: CATEGORIA_PENDIENTE } },
    update: {},
    create: { ferreteriaId, nombre: CATEGORIA_PENDIENTE },
  });
  return prisma.subCategoria.upsert({
    where: { categoriaId_nombre: { categoriaId: categoria.id, nombre: SUBCATEGORIA_PENDIENTE } },
    update: {},
    create: { ferreteriaId, categoriaId: categoria.id, nombre: SUBCATEGORIA_PENDIENTE },
  });
}

async function obtenerMarcaPendiente(ferreteriaId: string) {
  return prisma.marca.upsert({
    where: { ferreteriaId_nombre: { ferreteriaId, nombre: MARCA_PENDIENTE } },
    update: {},
    create: { ferreteriaId, nombre: MARCA_PENDIENTE },
  });
}

// Códigos cortos random (ej. "RAP-K3F9Q2") — la ferretería les va a poner
// el código real de catálogo cuando complete la ficha, esto es solo para
// no dejar el campo obligatorio vacío mientras tanto.
function codigoAlAzar(): string {
  return `RAP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function generarCodigoRapidoUnico(ferreteriaId: string): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = codigoAlAzar();
    const existe = await prisma.producto.findUnique({ where: { ferreteriaId_codigo: { ferreteriaId, codigo } } });
    if (!existe) return codigo;
  }
  // Prácticamente inalcanzable (colisionar 5 veces seguidas en un espacio
  // de 36^6), pero un id sí es único por definición.
  return `RAP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// Alta mínima de un producto durante una venta o compra, cuando el que
// necesitan no está cargado: solo pide un nombre. Queda "pendiente de
// clasificar" (categoría/familia/marca genéricas, precio en 0, sin código
// de barras) para que alguien con permiso de Productos complete la ficha
// después — el punto de venta no se detiene por eso.
export async function crearProductoPendiente(ferreteriaId: string, descripcion: string) {
  const [subCategoria, marca, codigo] = await Promise.all([
    obtenerSubCategoriaPendiente(ferreteriaId),
    obtenerMarcaPendiente(ferreteriaId),
    generarCodigoRapidoUnico(ferreteriaId),
  ]);

  return prisma.producto.create({
    data: {
      ferreteriaId,
      codigo,
      descripcion,
      subCategoriaId: subCategoria.id,
      marcaId: marca.id,
    },
  });
}
