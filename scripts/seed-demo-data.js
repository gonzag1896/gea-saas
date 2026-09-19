const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function seedDemoData() {
  try {
    console.log("📊 Cargando datos de demostración en Los Quebrachos...\n");

    const ferreteria = await prisma.ferreteria.findUnique({
      where: { slug: "los-quebrachos" },
    });

    const dueño = await prisma.usuario.findUnique({
      where: { email: "dueno-lq@gea.local" },
    });

    console.log("🧹 Limpiando datos existentes...");
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.precioProducto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.listaPrecio.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.subCategoria.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.categoria.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.marca.deleteMany({ where: { ferreteriaId: ferreteria.id } });

    console.log("📂 Creando categorías...");
    const cat1 = await prisma.categoria.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Herramientas Manuales" },
    });
    const cat2 = await prisma.categoria.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Herramientas Eléctricas" },
    });
    const cat3 = await prisma.categoria.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Materiales de Construcción" },
    });
    const cat4 = await prisma.categoria.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Herrajes y Cerraduras" },
    });
    const cat5 = await prisma.categoria.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Pinturas y Adhesivos" },
    });

    console.log("🏷️  Creando sub-categorías...");
    const sub1 = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteria.id, categoriaId: cat1.id, nombre: "Manuales - Variedad" },
    });
    const sub2 = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteria.id, categoriaId: cat2.id, nombre: "Eléctricas - Variedad" },
    });
    const sub3 = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteria.id, categoriaId: cat3.id, nombre: "Construcción - Variedad" },
    });
    const sub4 = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteria.id, categoriaId: cat4.id, nombre: "Herrajes - Variedad" },
    });
    const sub5 = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteria.id, categoriaId: cat5.id, nombre: "Pinturas - Variedad" },
    });

    console.log("🎨 Creando marcas...");
    const mar1 = await prisma.marca.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Bosch" },
    });
    const mar2 = await prisma.marca.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Makita" },
    });
    const mar3 = await prisma.marca.create({
      data: { ferreteriaId: ferreteria.id, nombre: "DeWalt" },
    });
    const mar4 = await prisma.marca.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Stanley" },
    });
    const mar5 = await prisma.marca.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Truper" },
    });

    console.log("📦 Creando productos...");
    const prod1 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "HM-001",
        descripcion: "Martillo de goma 500g",
        subCategoriaId: sub1.id,
        marcaId: mar5.id,
        precioCosto: 250,
        precioVenta: 450,
        stockActual: 25,
        stockMinimo: 5,
      },
    });
    const prod2 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "HM-002",
        descripcion: "Destornillador Phillips 3",
        subCategoriaId: sub1.id,
        marcaId: mar4.id,
        precioCosto: 150,
        precioVenta: 280,
        stockActual: 40,
        stockMinimo: 10,
      },
    });
    const prod3 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "HE-001",
        descripcion: "Taladro atornillador inalámbrico 18V",
        subCategoriaId: sub2.id,
        marcaId: mar1.id,
        precioCosto: 3500,
        precioVenta: 6200,
        stockActual: 8,
        stockMinimo: 2,
      },
    });
    const prod4 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "HE-002",
        descripcion: "Amoladora angular 115mm",
        subCategoriaId: sub2.id,
        marcaId: mar2.id,
        precioCosto: 2800,
        precioVenta: 4900,
        stockActual: 12,
        stockMinimo: 3,
      },
    });
    const prod5 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "MC-001",
        descripcion: "Cemento Portland bolsa 50kg",
        subCategoriaId: sub3.id,
        marcaId: mar4.id,
        precioCosto: 450,
        precioVenta: 650,
        stockActual: 100,
        stockMinimo: 20,
      },
    });
    const prod6 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "HC-001",
        descripcion: "Candado de seguridad 40mm",
        subCategoriaId: sub4.id,
        marcaId: mar4.id,
        precioCosto: 320,
        precioVenta: 550,
        stockActual: 35,
        stockMinimo: 10,
      },
    });
    const prod7 = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteria.id,
        codigo: "PA-001",
        descripcion: "Pintura látex interior blanco 20L",
        subCategoriaId: sub5.id,
        marcaId: mar5.id,
        precioCosto: 2500,
        precioVenta: 4200,
        stockActual: 18,
        stockMinimo: 4,
      },
    });

    console.log("👥 Creando clientes...");
    const cli1 = await prisma.cliente.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Construcciones Pérez SRL", telefono: "098765432" },
    });
    const cli2 = await prisma.cliente.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Pinturas García", telefono: "097654321" },
    });
    const cli3 = await prisma.cliente.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Reparaciones López", telefono: "096543210" },
    });
    const cli4 = await prisma.cliente.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Industrias Martínez", telefono: "095432109" },
    });
    const cli5 = await prisma.cliente.create({
      data: { ferreteriaId: ferreteria.id, nombre: "El Sr. Fontanero", telefono: "094321098" },
    });

    console.log("🏢 Creando proveedores...");
    const prov1 = await prisma.proveedor.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Distribuidora Nacional", rut: "210000000001", telefono: "098765432" },
    });
    const prov2 = await prisma.proveedor.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Importadora del Sur", rut: "210000000002", telefono: "097654321" },
    });
    const prov3 = await prisma.proveedor.create({
      data: { ferreteriaId: ferreteria.id, nombre: "Manufacturera Central", rut: "210000000003", telefono: "096543210" },
    });

    console.log("💰 Creando ventas...");
    const vta1 = await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId: cli1.id,
        fecha: new Date("2026-09-10"),
        estado: "CONFIRMADO",
        medioPago: "CREDITO",
        tipoIva: "TOTAL",
        subtotal: 8400,
        iva: 1848,
        entrega: 0,
        total: 10248,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.ventaDetalle.createMany({
      data: [
        {
          ferreteriaId: ferreteria.id,
          ventaId: vta1.id,
          productoId: prod3.id,
          precio: 6200,
          cantidad: 1,
          cantidadDevuelta: 0,
          descuento: 0,
          total: 6200,
          totalVigente: 6200,
        },
        {
          ferreteriaId: ferreteria.id,
          ventaId: vta1.id,
          productoId: prod5.id,
          precio: 650,
          cantidad: 2,
          cantidadDevuelta: 0,
          descuento: 10,
          total: 1170,
          totalVigente: 1170,
        },
      ],
    });

    const vta2 = await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId: cli2.id,
        fecha: new Date("2026-09-12"),
        estado: "CONFIRMADO",
        medioPago: "CONTADO",
        tipoIva: "EXENTO",
        subtotal: 4200,
        iva: 0,
        entrega: 0,
        total: 4200,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.ventaDetalle.create({
      data: {
        ferreteriaId: ferreteria.id,
        ventaId: vta2.id,
        productoId: prod7.id,
        precio: 4200,
        cantidad: 1,
        cantidadDevuelta: 0,
        descuento: 0,
        total: 4200,
        totalVigente: 4200,
      },
    });

    const vta3 = await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId: cli3.id,
        fecha: new Date("2026-09-15"),
        estado: "CONFIRMADO",
        medioPago: "CREDITO",
        tipoIva: "TOTAL",
        subtotal: 6450,
        iva: 1419,
        entrega: 0,
        total: 7869,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.ventaDetalle.createMany({
      data: [
        {
          ferreteriaId: ferreteria.id,
          ventaId: vta3.id,
          productoId: prod1.id,
          precio: 450,
          cantidad: 5,
          cantidadDevuelta: 0,
          descuento: 0,
          total: 2250,
          totalVigente: 2250,
        },
        {
          ferreteriaId: ferreteria.id,
          ventaId: vta3.id,
          productoId: prod4.id,
          precio: 4900,
          cantidad: 1,
          cantidadDevuelta: 0,
          descuento: 5,
          total: 4655,
          totalVigente: 4655,
        },
      ],
    });

    console.log("📥 Creando compras...");
    const cpa1 = await prisma.compra.create({
      data: {
        ferreteriaId: ferreteria.id,
        proveedorId: prov1.id,
        fecha: new Date("2026-09-08"),
        numeroFactura: "FAC-2026-001",
        estado: "CONFIRMADO",
        medioPago: "CREDITO",
        observaciones: "Pedido urgente",
        subtotal: 14400,
        iva: 3168,
        total: 17568,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.compraDetalle.createMany({
      data: [
        {
          ferreteriaId: ferreteria.id,
          compraId: cpa1.id,
          productoId: prod3.id,
          cantidad: 3,
          costoUnitario: 3500,
          descuento: 5,
          tipoIva: "TOTAL",
          subtotal: 10500,
        },
        {
          ferreteriaId: ferreteria.id,
          compraId: cpa1.id,
          productoId: prod5.id,
          cantidad: 10,
          costoUnitario: 450,
          descuento: 0,
          tipoIva: "TOTAL",
          subtotal: 4500,
        },
      ],
    });

    const cpa2 = await prisma.compra.create({
      data: {
        ferreteriaId: ferreteria.id,
        proveedorId: prov2.id,
        fecha: new Date("2026-09-11"),
        numeroFactura: "FAC-2026-002",
        estado: "CONFIRMADO",
        medioPago: "CONTADO",
        subtotal: 8960,
        iva: 0,
        total: 8960,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.compraDetalle.createMany({
      data: [
        {
          ferreteriaId: ferreteria.id,
          compraId: cpa2.id,
          productoId: prod2.id,
          cantidad: 32,
          costoUnitario: 150,
          descuento: 10,
          tipoIva: "EXENTO",
          subtotal: 4320,
        },
        {
          ferreteriaId: ferreteria.id,
          compraId: cpa2.id,
          productoId: prod6.id,
          cantidad: 20,
          costoUnitario: 320,
          descuento: 0,
          tipoIva: "EXENTO",
          subtotal: 6400,
        },
      ],
    });

    console.log("💳 Registrando movimientos de cuenta corriente...");

    await prisma.cuentaCliente.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId: cli1.id,
        fecha: new Date("2026-09-10"),
        debe: "10248",
        haber: "0",
        origenTipo: "VENTA_CREDITO",
        referencia: `Venta ${vta1.id.slice(0, 8)}`,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.cuentaCliente.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId: cli3.id,
        fecha: new Date("2026-09-15"),
        debe: "7869",
        haber: "0",
        origenTipo: "VENTA_CREDITO",
        referencia: `Venta ${vta3.id.slice(0, 8)}`,
        registradoPorUsuarioId: dueño.id,
      },
    });

    await prisma.cuentaProveedor.create({
      data: {
        ferreteriaId: ferreteria.id,
        proveedorId: prov1.id,
        fecha: new Date("2026-09-08"),
        debe: "0",
        haber: "17568",
        origenTipo: "COMPRA_CREDITO",
        referencia: `Compra ${cpa1.id.slice(0, 8)}`,
        registradoPorUsuarioId: dueño.id,
      },
    });

    console.log("\n" + "=".repeat(70));
    console.log("✅ DATOS DE DEMOSTRACIÓN CARGADOS\n");
    console.log("📊 Resumen:");
    console.log(`   📂 Categorías: 5`);
    console.log(`   📦 Productos: 7`);
    console.log(`   👥 Clientes: 5`);
    console.log(`   🏢 Proveedores: 3`);
    console.log(`   💰 Ventas: 3 (2 a crédito, 1 contado)`);
    console.log(`   📥 Compras: 2 (1 a crédito, 1 contado)`);
    console.log("=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData();
