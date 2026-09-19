import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { calcularSaldoCliente, registrarCobro, clientesConSaldoVencido } from "@/lib/cuenta-corriente";
import { confirmarVenta, registrarDevolucionVenta } from "@/lib/ventas";

describe("cuenta corriente — saldo y cobros", () => {
  const sufijo = `cc-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente CC Test" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-CC", descripcion: "Producto de prueba", subCategoriaId: subCategoria.id, marcaId: marca.id, stockActual: 100 },
    })).id;
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  it("un cliente sin movimientos tiene saldo 0", async () => {
    const otroCliente = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Sin movimientos" } });
    expect(await calcularSaldoCliente(ferreteria.id, otroCliente.id)).toBe(0);
  });

  it("registrar un cobro crea un Haber y baja el saldo exactamente ese monto", async () => {
    // Este cliente arranca en 0: un cobro sin deuda previa lo deja en
    // negativo (a favor del cliente) — no hay tope contra el saldo,
    // decisión pendiente #2 del informe, sin cerrar.
    const antes = await calcularSaldoCliente(ferreteria.id, clienteId);
    await registrarCobro(ferreteria.id, clienteId, 100, dueno.id, "Adelanto");
    expect((await calcularSaldoCliente(ferreteria.id, clienteId)) - antes).toBe(-100);

    const asiento = await prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, origenTipo: "COBRO" } });
    expect(Number(asiento.haber)).toBe(100);
    expect(Number(asiento.debe)).toBe(0);
    expect(asiento.referencia).toBe("Adelanto");
  });

  // Caso explícito del criterio de terminado de la fase: venta a crédito +
  // cobro parcial + devolución, verificando el saldo final a mano.
  it("saldo correcto tras venta a crédito + cobro parcial + devolución parcial", async () => {
    const clienteEscenario = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Escenario CC" } });

    const venta = await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id, clienteId: clienteEscenario.id, fecha: new Date(), medioPago: "CREDITO",
        subtotal: 1000, iva: 0, total: 1000,
        detalle: { create: [{ productoId, cantidad: 10, precio: 100, total: 1000, totalVigente: 1000 }] },
      },
    });
    await confirmarVenta(ferreteria.id, venta.id, dueno.id); // Debe 1000

    await registrarCobro(ferreteria.id, clienteEscenario.id, 400, dueno.id); // Haber 400 → saldo 600

    const detalle = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });
    await registrarDevolucionVenta(ferreteria.id, detalle.id, 2, "no era el color", dueno.id); // Haber 200 → saldo 400

    expect(await calcularSaldoCliente(ferreteria.id, clienteEscenario.id)).toBe(400);
  });

  it("varios cobros y ventas a lo largo del tiempo acumulan correctamente", async () => {
    const clienteAcum = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Acumulado CC" } });

    for (const total of [200, 300]) {
      const venta = await prisma.venta.create({
        data: {
          ferreteriaId: ferreteria.id, clienteId: clienteAcum.id, fecha: new Date(), medioPago: "CREDITO",
          subtotal: total, iva: 0, total,
          detalle: { create: [{ productoId, cantidad: 1, precio: total, total, totalVigente: total }] },
        },
      });
      await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    }
    await registrarCobro(ferreteria.id, clienteAcum.id, 150, dueno.id);

    // 200 + 300 (Debe) - 150 (Haber) = 350
    expect(await calcularSaldoCliente(ferreteria.id, clienteAcum.id)).toBe(350);
  });

  it("clientesConSaldoVencido detecta un Debe de hace más de 30 días sin cancelar, e ignora al que ya está saldado o es reciente", async () => {
    const clienteVencido = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Vencido CC" } });
    const clienteAlDia = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Al día CC" } });
    const clienteReciente = await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Reciente CC" } });

    const hace35Dias = new Date(Date.now() - 35 * 86_400_000);
    await prisma.cuentaCliente.create({
      data: { ferreteriaId: ferreteria.id, clienteId: clienteVencido.id, fecha: hace35Dias, debe: 500, haber: 0, origenTipo: "VENTA_CREDITO" },
    });

    await prisma.cuentaCliente.create({
      data: { ferreteriaId: ferreteria.id, clienteId: clienteAlDia.id, fecha: hace35Dias, debe: 500, haber: 0, origenTipo: "VENTA_CREDITO" },
    });
    await registrarCobro(ferreteria.id, clienteAlDia.id, 500, dueno.id); // saldo queda en 0

    await prisma.cuentaCliente.create({
      data: { ferreteriaId: ferreteria.id, clienteId: clienteReciente.id, fecha: new Date(), debe: 500, haber: 0, origenTipo: "VENTA_CREDITO" },
    });

    const vencidos = await clientesConSaldoVencido(ferreteria.id, 30);
    const ids = vencidos.map((v) => v.id);

    expect(ids).toContain(clienteVencido.id);
    expect(ids).not.toContain(clienteAlDia.id);
    expect(ids).not.toContain(clienteReciente.id);

    const fila = vencidos.find((v) => v.id === clienteVencido.id)!;
    expect(fila.saldo).toBe(500);
    expect(fila.diasVencido).toBeGreaterThanOrEqual(35);
  });
});
