import { prisma } from "@/lib/db";
import type { RolFerreteria } from "@prisma/client";

// Fixtures mínimas para tests de integración contra el Postgres local. No
// es una abstracción de producción — solo evita repetir el mismo
// beforeAll/afterAll de "una ferretería + un usuario con rol X" en cada
// archivo de test.
export async function crearFerreteriaConUsuario(sufijo: string, rol: RolFerreteria) {
  const ferreteria = await prisma.ferreteria.create({ data: { nombre: `Fixture ${sufijo}` } });
  const usuario = await prisma.usuario.create({ data: { email: `${sufijo}@test.gea`, estado: "ACTIVO" } });
  await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: usuario.id, rol } });
  return { ferreteria, usuario };
}

export async function borrarFixture(ferreteriaId: string, usuarioIds: string[]) {
  await prisma.ferreteria.delete({ where: { id: ferreteriaId } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
}
