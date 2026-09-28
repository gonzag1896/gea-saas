import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

describe("/api/clientes — RUT, email, dirección y ciudad", () => {
  const sufijo = `clientes-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
  });

  afterAll(async () => {
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  it("crea un cliente con todos los datos y los devuelve en el listado", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await POST(new Request("http://test/api/clientes", {
      method: "POST",
      body: JSON.stringify({ nombre: "Ferretería El Clavo", rut: "210000000101", email: "contacto@elclavo.uy", direccion: "Ruta 5 km 10", ciudad: "Canelones" }),
    }));
    expect(res.status).toBe(201);
    const { cliente } = await res.json();
    expect(cliente).toMatchObject({ rut: "210000000101", email: "contacto@elclavo.uy", direccion: "Ruta 5 km 10", ciudad: "Canelones" });

    const { clientes } = await (await GET()).json();
    expect(clientes.find((c: { id: string }) => c.id === cliente.id)).toMatchObject({ rut: "210000000101" });
  });

  it("rechaza un segundo cliente con el mismo RUT en la misma ferretería", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    await POST(new Request("http://test/api/clientes", { method: "POST", body: JSON.stringify({ nombre: "A", rut: "210000000202" }) }));
    const res = await POST(new Request("http://test/api/clientes", { method: "POST", body: JSON.stringify({ nombre: "B", rut: "210000000202" }) }));
    expect(res.status).toBe(409);
  });

  it("permite varios clientes sin RUT (NULL no choca)", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const a = await POST(new Request("http://test/api/clientes", { method: "POST", body: JSON.stringify({ nombre: "Sin RUT 1" }) }));
    const b = await POST(new Request("http://test/api/clientes", { method: "POST", body: JSON.stringify({ nombre: "Sin RUT 2" }) }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it("editar con rut vacío limpia el RUT en vez de guardar un string vacío", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const creado = await (await POST(new Request("http://test/api/clientes", { method: "POST", body: JSON.stringify({ nombre: "C", rut: "210000000303" }) }))).json();
    const res = await PATCH(new Request("http://test/api/clientes/x", { method: "PATCH", body: JSON.stringify({ rut: "" }) }), { params: { id: creado.cliente.id } });
    expect(res.status).toBe(200);
    const actualizado = await prisma.cliente.findUnique({ where: { id: creado.cliente.id } });
    expect(actualizado?.rut).toBeNull();
  });
});
