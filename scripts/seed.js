// Siembra 2 ferreterías demo — no 1 — a propósito: la Fase 4 (multi-tenancy)
// necesita dos tenants ya existentes para poder probar de entrada que un
// usuario de la Ferretería A nunca ve datos de la Ferretería B. Correr esto
// una vez más no duplica nada: usa upsert por email/nombre en todos lados.
//
// Uso:  npm run db:seed
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const PASSWORD_DEMO = "Demo1234!"; // Solo para desarrollo local — nunca en un ambiente real.

async function seedFerreteria({ nombre, slug, duenoEmail, duenoNombre }) {
  const ferreteria = await prisma.ferreteria.upsert({
    where: { slug },
    update: {},
    create: { nombre, slug },
  });

  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);
  const usuario = await prisma.usuario.upsert({
    where: { email: duenoEmail },
    update: {},
    create: { email: duenoEmail, name: duenoNombre, passwordHash, estado: "ACTIVO" },
  });

  await prisma.ferreteriaUsuario.upsert({
    where: { ferreteriaId_usuarioId: { ferreteriaId: ferreteria.id, usuarioId: usuario.id } },
    update: {},
    create: { ferreteriaId: ferreteria.id, usuarioId: usuario.id, rol: "DUENO" },
  });

  const categoria = await prisma.categoria.upsert({
    where: { ferreteriaId_nombre: { ferreteriaId: ferreteria.id, nombre: "Herramientas" } },
    update: {},
    create: { ferreteriaId: ferreteria.id, nombre: "Herramientas" },
  });

  const subCategoria = await prisma.subCategoria.upsert({
    where: { categoriaId_nombre: { categoriaId: categoria.id, nombre: "Taladros" } },
    update: {},
    create: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Taladros" },
  });

  const marca = await prisma.marca.upsert({
    where: { ferreteriaId_nombre: { ferreteriaId: ferreteria.id, nombre: "Genérica" } },
    update: {},
    create: { ferreteriaId: ferreteria.id, nombre: "Genérica" },
  });

  await prisma.producto.upsert({
    where: { ferreteriaId_codigo: { ferreteriaId: ferreteria.id, codigo: "DEMO-001" } },
    update: {},
    create: {
      ferreteriaId: ferreteria.id,
      codigo: "DEMO-001",
      descripcion: "Producto de demostración",
      subCategoriaId: subCategoria.id,
      marcaId: marca.id,
      precioCosto: 100,
      precioVenta: 150,
      stockActual: 10,
      stockMinimo: 2,
    },
  });

  // Cliente no tiene UNIQUE de negocio (igual que en el GeneXus original) —
  // se busca por nombre a mano para que correr el seed dos veces no duplique.
  const clienteExistente = await prisma.cliente.findFirst({ where: { ferreteriaId: ferreteria.id, nombre: "Cliente Demo" } });
  if (!clienteExistente) {
    await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Demo", telefono: "099000000" } });
  }

  // El UNIQUE parcial de (ferreteriaId, rut) es SQL agregado a mano en la
  // migración (ver prisma/migrations): Prisma Client no lo conoce para
  // upsert, así que se busca a mano igual que Cliente.
  const proveedorExistente = await prisma.proveedor.findFirst({ where: { ferreteriaId: ferreteria.id, rut: "210000000015" } });
  if (!proveedorExistente) {
    await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Demo", rut: "210000000015", telefono: "099111111" } });
  }

  return { ferreteria, usuario };
}

async function main() {
  const a = await seedFerreteria({
    nombre: "Ferretería Demo A",
    slug: "ferreteria-demo-a",
    duenoEmail: "dueno-a@demo.gea",
    duenoNombre: "Dueño Demo A",
  });
  const b = await seedFerreteria({
    nombre: "Ferretería Demo B",
    slug: "ferreteria-demo-b",
    duenoEmail: "dueno-b@demo.gea",
    duenoNombre: "Dueño Demo B",
  });

  console.log("Seed OK:");
  console.log(`  ${a.ferreteria.nombre} (${a.ferreteria.id}) — ${a.usuario.email} / ${PASSWORD_DEMO}`);
  console.log(`  ${b.ferreteria.nombre} (${b.ferreteria.id}) — ${b.usuario.email} / ${PASSWORD_DEMO}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
