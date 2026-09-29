// Orden alfabético "humano": sin distinguir mayúsculas de minúsculas ni
// acentos. El ORDER BY de Postgres por sí solo no alcanza — con la
// collation por defecto separa todo el bloque en mayúsculas del de
// minúsculas (A-Z primero, después a-z), así que "eco campo" terminaba
// lejos de "ECHEVERRIA…" en vez de al lado.
export function ordenarPorNombre<T extends { nombre: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}
