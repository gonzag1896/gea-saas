import { describe, it, expect } from "vitest";
import { ordenarPorNombre } from "./ordenar";

describe("ordenarPorNombre", () => {
  it("intercala mayúsculas y minúsculas en vez de agrupar todo un bloque primero", () => {
    // Con la collation por defecto de Postgres, ORDER BY nombre deja TODO
    // el bloque en mayúsculas antes que CUALQUIER minúscula — "eco campo"
    // termina lejísimos de "ECHEVERRIA...", que es justo el bug reportado.
    const nombres = ["ZURBLIN S A", "eco campo", "ABIELO S.R.L.", "luis Alfredo"];
    const orden = ordenarPorNombre(nombres.map((nombre) => ({ nombre }))).map((c) => c.nombre);
    expect(orden).toEqual(["ABIELO S.R.L.", "eco campo", "luis Alfredo", "ZURBLIN S A"]);
  });

  it("ordena acentos junto a su letra base", () => {
    const nombres = ["Zapata", "Ñandú", "Álvarez", "Andrade"];
    const orden = ordenarPorNombre(nombres.map((nombre) => ({ nombre }))).map((c) => c.nombre);
    expect(orden).toEqual(["Álvarez", "Andrade", "Ñandú", "Zapata"]);
  });

  it("no muta el arreglo original", () => {
    const original = [{ nombre: "B" }, { nombre: "A" }];
    ordenarPorNombre(original);
    expect(original.map((c) => c.nombre)).toEqual(["B", "A"]);
  });
});
