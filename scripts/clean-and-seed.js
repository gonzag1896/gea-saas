const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const PASSWORD_DEMO = "Demo1234!";

async function cleanDatabase() {
  console.log("🧹 Limpiando base de datos...");

  const ferreterias = await prisma.ferreteria.findMany();

  for (const ferreteria of ferreterias) {
    console.log(`  Eliminando: ${ferreteria.nombre}`);

    await prisma.devolucionCompra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.precioProducto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cierreCaja.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.auditLog.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.listaPrecio.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.marca.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.subCategoria.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.categoria.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteriaUsuario.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
  }

  const usuariosHuerfanos = await prisma.usuario.findMany({
    where: {
      ferreterias: { none: {} },
      isSuperAdmin: false,
    },
  });

  for (const usuario of usuariosHuerfanos) {
    await prisma.usuario.delete({ where: { id: usuario.id } });
  }

  console.log("✅ Base de datos limpia\n");
}

async function createFerreteria({ nombre, slug, roles }) {
  console.log(`📍 Creando ferretería: ${nombre}`);

  const ferreteria = await prisma.ferreteria.create({
    data: { nombre, slug },
  });

  const usuarios = {};

  for (const { email, name, rol } of roles) {
    const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);

    let usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          email,
          name,
          passwordHash,
          estado: "ACTIVO",
        },
      });
      console.log(`  ✓ ${name} (${email})`);
    }

    await prisma.ferreteriaUsuario.create({
      data: {
        ferreteriaId: ferreteria.id,
        usuarioId: usuario.id,
        rol,
      },
    });

    usuarios[rol] = { email, name };
  }

  return { ferreteria, usuarios };
}

async function createDemoData(ferreteriaId) {
  const categoria = await prisma.categoria.create({
    data: { ferreteriaId, nombre: "Herramientas" },
  });

  const subCategoria = await prisma.subCategoria.create({
    data: { ferreteriaId, categoriaId: categoria.id, nombre: "Taladros" },
  });

  const marca = await prisma.marca.create({
    data: { ferreteriaId, nombre: "Genérica" },
  });

  await prisma.producto.create({
    data: {
      ferreteriaId,
      codigo: `DEMO-${ferreteriaId.slice(0, 8)}`,
      descripcion: "Producto de demostración",
      subCategoriaId: subCategoria.id,
      marcaId: marca.id,
      precioCosto: 100,
      precioVenta: 150,
      stockActual: 10,
      stockMinimo: 2,
    },
  });

  await prisma.cliente.create({
    data: {
      ferreteriaId,
      nombre: "Cliente Demo",
      telefono: "099000000",
    },
  });

  await prisma.proveedor.create({
    data: {
      ferreteriaId,
      nombre: "Proveedor Demo",
      rut: "210000000015",
      telefono: "099111111",
    },
  });
}

async function main() {
  try {
    await cleanDatabase();

    const losQuebrachos = await createFerreteria({
      nombre: "Los Quebrachos",
      slug: "los-quebrachos",
      roles: [
        { email: "dueno-lq@gea.local", name: "Dueño", rol: "DUENO" },
        { email: "cajero-lq@gea.local", name: "Cajero", rol: "CAJERO" },
        { email: "deposito-lq@gea.local", name: "Depósito", rol: "DEPOSITO" },
      ],
    });

    const mpFerreteria = await createFerreteria({
      nombre: "MP Ferretería",
      slug: "mp-ferreteria",
      roles: [
        { email: "dueno-mp@gea.local", name: "Dueño", rol: "DUENO" },
        { email: "cajero-mp@gea.local", name: "Cajero", rol: "CAJERO" },
        { email: "deposito-mp@gea.local", name: "Depósito", rol: "DEPOSITO" },
      ],
    });

    console.log("\n📦 Creando datos demo...");
    await createDemoData(losQuebrachos.ferreteria.id);
    await createDemoData(mpFerreteria.ferreteria.id);

    console.log("\n👑 Creando Super Admin...");
    const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);
    const superAdmin = await prisma.usuario.upsert({
      where: { email: "super@gea.local" },
      update: {},
      create: {
        email: "super@gea.local",
        name: "Super Admin",
        passwordHash,
        estado: "ACTIVO",
        isSuperAdmin: true,
      },
    });

    console.log("\n" + "=".repeat(70));
    console.log("✅ SEED COMPLETADO\n");
    console.log("📍 LOS QUEBRACHOS");
    console.log("   Dueño:    dueno-lq@gea.local / " + PASSWORD_DEMO);
    console.log("   Cajero:   cajero-lq@gea.local / " + PASSWORD_DEMO);
    console.log("   Depósito: deposito-lq@gea.local / " + PASSWORD_DEMO);
    console.log("\n📍 MP FERRETERÍA");
    console.log("   Dueño:    dueno-mp@gea.local / " + PASSWORD_DEMO);
    console.log("   Cajero:   cajero-mp@gea.local / " + PASSWORD_DEMO);
    console.log("   Depósito: deposito-mp@gea.local / " + PASSWORD_DEMO);
    console.log("\n👑 SUPER ADMIN");
    console.log("   super@gea.local / " + PASSWORD_DEMO);
    console.log("=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
