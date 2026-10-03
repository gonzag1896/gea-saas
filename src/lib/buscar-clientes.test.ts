import { describe, it, expect } from "vitest";
import { filtrarClientes } from "@/lib/buscar-clientes";

const clientes = [
  { id: "1", nombre: "DIAZ BENITEZ ESTEBAN DANIEL", rut: "21.123.456-0012" },
  { id: "2", nombre: "Diego Tito", rut: null },
  { id: "3", nombre: "DUCK LOPEZ BERNARDO GUSTAVO" },
  { id: "4", nombre: "ECHEVERRIA MORALES JAVIER ALEJANDRO" },
  { id: "5", nombre: "eco campo" },
  { id: "6", nombre: "Felipe Fuente" },
];

describe("filtrarClientes", () => {
  it("sin texto devuelve todos, en el mismo orden", () => {
    expect(filtrarClientes(clientes, "  ").map((c) => c.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("ignora mayúsculas y acentos", () => {
    expect(filtrarClientes(clientes, "FELIPE").map((c) => c.id)).toEqual(["6"]);
    expect(filtrarClientes(clientes, "echévérria").map((c) => c.id)).toEqual(["4"]);
  });

  it("todas las palabras tienen que estar, en cualquier orden", () => {
    expect(filtrarClientes(clientes, "esteban diaz").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, "diaz tito")).toEqual([]);
  });

  it("los que empiezan con lo escrito van primero", () => {
    // "di" está en DIAZ (empieza), Diego (empieza) y DUCK... no; ECHEVERRIA... no
    const ids = filtrarClientes([{ id: "a", nombre: "Los Diaz" }, { id: "b", nombre: "Diaz Hnos" }], "diaz").map((c) => c.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("busca por RUT sin importar puntos ni guiones, desde 3 caracteres", () => {
    expect(filtrarClientes(clientes, "21123456").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, "21.123.456-0012").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, "12")).toEqual([]);
  });

  it("sin resultados devuelve lista vacía", () => {
    expect(filtrarClientes(clientes, "zzz")).toEqual([]);
  });
});
