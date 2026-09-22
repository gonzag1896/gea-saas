// Los campos `fecha` de este dominio (Venta, Compra, CierreCaja,
// movimientos de stock, cuentas corrientes, cotización BCU) son fechas
// calendario sin hora — en la base, columnas `@db.Date`, que Prisma
// serializa como medianoche UTC de ese día ("2026-09-21T00:00:00.000Z").
//
// Formatear ese valor con `toLocaleDateString()` sin fijar el huso usa el
// huso horario LOCAL de quien mira la pantalla. Uruguay es UTC-3, así que
// esa medianoche UTC cae a las 21:00 del día ANTERIOR en Montevideo — el
// mismo cierre de caja del 21/9 se mostraba como 20/9. El bug no es
// intermitente ni depende del horario en que se use el sistema: pasa
// siempre, para cualquier fecha, en cualquier huso con offset negativo.
//
// La fecha "correcta" es la que se guardó, en UTC — así que se formatea
// siempre fijando `timeZone: "UTC"`, sin importar el huso del navegador o
// del servidor que renderiza.
export function formatearFecha(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-UY", { timeZone: "UTC" });
}

// Para el puñado de casos que sí quieren "la fecha de hoy en Uruguay" en
// vez de una fecha ya guardada (ej. "Lista de precios vigente al ..." en
// un PDF) — acá sí importa el huso real de Montevideo, no UTC, porque es
// el calendario del día tal como lo vive el usuario, no un valor ya fijado
// en la base.
export function formatearFechaHoyUruguay(): string {
  return new Date().toLocaleDateString("es-UY", { timeZone: "America/Montevideo" });
}

// "Hoy" como fecha calendario en Uruguay, representada igual que cualquier
// columna @db.Date (medianoche UTC de ese día) — así se puede restar
// directo contra un valor guardado (ej. Ferreteria.vigenciaHasta) sin que
// el huso del proceso que corre el código (que en Vercel es UTC, no
// Montevideo) meta un día de diferencia.
export function hoyUruguayComoFecha(): Date {
  const hoyISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
  return new Date(`${hoyISO}T00:00:00.000Z`);
}

// Suma un mes calendario a una fecha @db.Date (medianoche UTC), operando
// en UTC para no depender del huso del proceso — mismo motivo que
// hoyUruguayComoFecha(). Si el mes de destino tiene menos días (ej. 31 de
// enero + 1 mes), Date.UTC lo corre al mes siguiente (comportamiento
// estándar de suma de meses, no se "clampea" al último día).
export function sumarUnMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate()));
}

// Días de calendario entre hoy (Uruguay) y una fecha guardada — negativo
// si ya pasó. Para el aviso de vencimiento de la mensualidad de la
// plataforma.
export function diasHastaUruguay(fecha: Date): number {
  const hoy = hoyUruguayComoFecha();
  return Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
}
