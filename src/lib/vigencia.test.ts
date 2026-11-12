import { describe, it, expect } from "vitest";
import { textoAvisoVigencia } from "@/lib/vigencia";

describe("textoAvisoVigencia", () => {
  it("vencida: dice desde cuándo y cuántos días lleva vencida", () => {
    const a = textoAvisoVigencia(-5, "7/11/2026");
    expect(a.vencida).toBe(true);
    expect(a.titulo).toBe("Cuota vencida");
    expect(a.detalle).toContain("venció el 7/11/2026 (hace 5 días)");
    expect(a.detalle).toContain("Regularizá el pago");
  });

  it("vencida ayer: singular", () => {
    expect(textoAvisoVigencia(-1, "7/11/2026").detalle).toContain("hace 1 día)");
  });

  it("vence hoy", () => {
    const a = textoAvisoVigencia(0, "12/11/2026");
    expect(a.vencida).toBe(false);
    expect(a.titulo).toBe("La cuota vence hoy");
  });

  it("vence en los próximos días: singular y plural", () => {
    expect(textoAvisoVigencia(1, "13/11/2026").titulo).toBe("La cuota vence en 1 día");
    expect(textoAvisoVigencia(3, "15/11/2026").titulo).toBe("La cuota vence en 3 días");
    expect(textoAvisoVigencia(3, "15/11/2026").detalle).toContain("vence el 15/11/2026");
  });
});

import { textoAccesoInhabilitado } from "@/lib/vigencia";

describe("textoAccesoInhabilitado", () => {
  it("con fecha de vencimiento la incluye", () => {
    const t = textoAccesoInhabilitado("22/10/2026", "Los Quebrachos");
    expect(t.titulo).toBe("Acceso inhabilitado");
    expect(t.subtitulo).toBe("Cuota vencida");
    expect(t.detalle).toBe("La mensualidad de la plataforma GEA de Los Quebrachos venció el 22/10/2026.");
    expect(t.accion).toContain("Contactanos");
  });

  it("sin fecha cargada igual dice que está vencida", () => {
    expect(textoAccesoInhabilitado(null, "Los Quebrachos").detalle).toBe("La mensualidad de la plataforma GEA de Los Quebrachos está vencida.");
  });
});
