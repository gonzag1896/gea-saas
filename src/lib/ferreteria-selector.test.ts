import { describe, it, expect } from "vitest";
import { resolverFerreteriaInicial, type MembresiaActiva } from "./ferreteria-selector";

const membresia = (id: string): MembresiaActiva => ({
  ferreteriaId: id,
  ferreteriaNombre: `Ferretería ${id}`,
  rol: "DUENO",
});

describe("resolverFerreteriaInicial", () => {
  it("sin membresías, no hay nada para resolver", () => {
    expect(resolverFerreteriaInicial([])).toBeNull();
  });

  it("con una sola membresía, se auto-selecciona", () => {
    const m = membresia("a");
    expect(resolverFerreteriaInicial([m])).toEqual(m);
  });

  it("con dos o más membresías, no se adivina cuál — decide el usuario", () => {
    expect(resolverFerreteriaInicial([membresia("a"), membresia("b")])).toBeNull();
  });
});
