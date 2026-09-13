import type { RolFerreteria } from "@prisma/client";

export type MembresiaActiva = {
  ferreteriaId: string;
  ferreteriaNombre: string;
  rol: RolFerreteria;
};

// Con una sola ferretería activa no tiene sentido pedirle a nadie que
// "elija" — se resuelve sola al loguearse. Con cero (usuario recién
// invitado sin ferretería todavía, o un Super Admin puro) o con dos o más,
// no hay una respuesta correcta que adivinar: queda en null a propósito,
// y es la pantalla de selección (o el modo soporte del Super Admin) la que
// completa el dato — nunca esta función ni el cliente.
export function resolverFerreteriaInicial(membresias: MembresiaActiva[]): MembresiaActiva | null {
  return membresias.length === 1 ? membresias[0] : null;
}
