import type { RolFerreteria } from "@prisma/client";

export type Modulo =
  | "ventas"
  | "compras"
  | "stock"
  | "ajustesStock"
  | "cuentaCorriente"
  | "cobros"
  | "clientes"
  | "proveedores"
  | "productos"
  | "precios"
  | "usuarios"
  | "roles"
  | "configuracion"
  | "auditoria";

export type Accion = "ver" | "crear" | "modificar" | "anular" | "eliminar";

// Matriz de la Revisión técnica final, sección 6. Dinero y anulaciones
// (Ventas/Compras/Precios) quedan concentrados en Dueño; Cajero opera el
// mostrador (ventas, cobros, clientes) sin tocar compras ni precios;
// Depósito opera mercadería (compras, stock, alta de productos) sin ver
// plata de clientes. "eliminar" en Productos/Usuarios es siempre baja
// lógica (activo=false / membresía INACTIVA), nunca borrado físico.
//
// Administración de tenants queda fuera: es el único módulo que no vive
// dentro de una ferretería (lo opera el Super Admin sobre la plataforma),
// pertenece al módulo aparte de administración de tenants, no a esta
// matriz por-ferretería.
const MATRIZ: Record<Modulo, Record<RolFerreteria, Accion[]>> = {
  ventas: { DUENO: ["ver", "crear", "modificar", "anular"], CAJERO: ["ver", "crear", "modificar"], DEPOSITO: [] },
  compras: { DUENO: ["ver", "crear", "modificar", "anular"], CAJERO: [], DEPOSITO: ["ver", "crear", "modificar"] },
  stock: { DUENO: ["ver"], CAJERO: ["ver"], DEPOSITO: ["ver"] },
  ajustesStock: { DUENO: ["ver", "crear"], CAJERO: [], DEPOSITO: ["ver", "crear"] },
  cuentaCorriente: { DUENO: ["ver"], CAJERO: ["ver"], DEPOSITO: [] },
  cobros: { DUENO: ["ver", "crear"], CAJERO: ["crear"], DEPOSITO: [] },
  clientes: { DUENO: ["ver", "crear", "modificar"], CAJERO: ["ver", "crear"], DEPOSITO: [] },
  proveedores: { DUENO: ["ver", "crear", "modificar"], CAJERO: [], DEPOSITO: ["ver", "crear"] },
  productos: { DUENO: ["ver", "crear", "modificar", "eliminar"], CAJERO: ["ver"], DEPOSITO: ["ver", "crear", "modificar"] },
  precios: { DUENO: ["ver", "modificar"], CAJERO: ["ver"], DEPOSITO: ["ver"] },
  usuarios: { DUENO: ["ver", "crear", "modificar", "eliminar"], CAJERO: [], DEPOSITO: [] },
  roles: { DUENO: ["ver", "modificar"], CAJERO: [], DEPOSITO: [] },
  configuracion: { DUENO: ["ver", "modificar"], CAJERO: [], DEPOSITO: [] },
  auditoria: { DUENO: ["ver"], CAJERO: [], DEPOSITO: [] },
};

export function tienePermiso(rol: RolFerreteria, modulo: Modulo, accion: Accion): boolean {
  return MATRIZ[modulo][rol].includes(accion);
}
