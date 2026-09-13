import { NextResponse } from "next/server";
import { CompraNoEncontradaError, CompraEstadoInvalidoError, CantidadInvalidaError } from "@/lib/compras";
import { StockInsuficienteError } from "@/lib/stock";

// Traduce las excepciones de dominio (compras, ventas, stock — todas las
// que van a ir apareciendo en las próximas fases) a la respuesta HTTP que
// le corresponde, en un solo lugar en vez de un try/catch repetido con la
// misma cadena de ifs en cada route handler.
export function manejarErrorNegocio(error: unknown): NextResponse {
  if (error instanceof CompraNoEncontradaError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof CompraEstadoInvalidoError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof CantidadInvalidaError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof StockInsuficienteError) return NextResponse.json({ error: error.message }, { status: 409 });
  throw error;
}
