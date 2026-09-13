import { describe, it, expect } from "vitest";
import { tienePermiso, type Modulo, type Accion } from "./permisos";

const MODULOS: Modulo[] = [
  "ventas",
  "compras",
  "stock",
  "ajustesStock",
  "cuentaCorriente",
  "cobros",
  "clientes",
  "proveedores",
  "productos",
  "precios",
  "usuarios",
  "roles",
  "configuracion",
  "auditoria",
];
const ACCIONES: Accion[] = ["ver", "crear", "modificar", "anular", "eliminar"];

// Puntos explícitos de la Revisión técnica final, sección 6 — no solo "la
// matriz tiene la forma esperada", sino los casos concretos que ahí se
// decidieron a propósito.
describe("tienePermiso — casos concretos de la matriz", () => {
  it("Dueño puede anular Ventas y Compras — Cajero y Depósito no", () => {
    expect(tienePermiso("DUENO", "ventas", "anular")).toBe(true);
    expect(tienePermiso("DUENO", "compras", "anular")).toBe(true);
    expect(tienePermiso("CAJERO", "ventas", "anular")).toBe(false);
    expect(tienePermiso("DEPOSITO", "compras", "anular")).toBe(false);
  });

  it("Cajero no tiene ningún acceso a Compras — es tarea de Depósito/Dueño", () => {
    for (const accion of ACCIONES) expect(tienePermiso("CAJERO", "compras", accion)).toBe(false);
  });

  it("Depósito no tiene ningún acceso a Ventas ni a Cuenta Corriente", () => {
    for (const accion of ACCIONES) {
      expect(tienePermiso("DEPOSITO", "ventas", accion)).toBe(false);
      expect(tienePermiso("DEPOSITO", "cuentaCorriente", accion)).toBe(false);
    }
  });

  it("solo Dueño modifica Precios — Cajero y Depósito solo ven", () => {
    expect(tienePermiso("DUENO", "precios", "modificar")).toBe(true);
    expect(tienePermiso("CAJERO", "precios", "ver")).toBe(true);
    expect(tienePermiso("CAJERO", "precios", "modificar")).toBe(false);
    expect(tienePermiso("DEPOSITO", "precios", "modificar")).toBe(false);
  });

  it("Usuarios, Roles, Configuración y Auditoría son exclusivos de Dueño", () => {
    for (const modulo of ["usuarios", "roles", "configuracion", "auditoria"] as Modulo[]) {
      expect(tienePermiso("CAJERO", modulo, "ver")).toBe(false);
      expect(tienePermiso("DEPOSITO", modulo, "ver")).toBe(false);
      expect(tienePermiso("DUENO", modulo, "ver")).toBe(true);
    }
  });

  it("nadie más que Dueño elimina (baja lógica) en Productos o Usuarios", () => {
    expect(tienePermiso("DUENO", "productos", "eliminar")).toBe(true);
    expect(tienePermiso("DUENO", "usuarios", "eliminar")).toBe(true);
    expect(tienePermiso("CAJERO", "productos", "eliminar")).toBe(false);
    expect(tienePermiso("DEPOSITO", "productos", "eliminar")).toBe(false);
  });

  it("Ventas/Compras nunca tienen 'eliminar' para ningún rol — se anulan, no se borran", () => {
    for (const rol of ["DUENO", "CAJERO", "DEPOSITO"] as const) {
      expect(tienePermiso(rol, "ventas", "eliminar")).toBe(false);
      expect(tienePermiso(rol, "compras", "eliminar")).toBe(false);
    }
  });
});

describe("tienePermiso — cobertura total (todo módulo × todo rol tiene una respuesta)", () => {
  it("no explota para ninguna combinación módulo/rol/acción", () => {
    for (const modulo of MODULOS) {
      for (const rol of ["DUENO", "CAJERO", "DEPOSITO"] as const) {
        for (const accion of ACCIONES) {
          expect(typeof tienePermiso(rol, modulo, accion)).toBe("boolean");
        }
      }
    }
  });
});
