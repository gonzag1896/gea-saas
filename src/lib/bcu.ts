// Consulta la cotización del dólar contra el webservice SOAP público del
// BCU (wsbcucotizaciones). No hay una versión REST/JSON oficial — el
// servicio real devuelve XML, así que se arma el sobre SOAP a mano en vez
// de sumar una librería SOAP entera solo para esta única llamada.
//
// Moneda 2225 = "DLS. USA BILLETE" (dólar billete, el que cotiza el
// público en general — no el cable ni el promedio fondo). Grupo 2 =
// monedas billete.
const BCU_URL = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";
const MONEDA_DOLAR_BILLETE = 2225;

export class ErrorConsultaBcu extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorConsultaBcu";
  }
}

export type CotizacionBcu = { compra: number; venta: number; fecha: string };

function fechaIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Busca la cotización más reciente disponible: si hoy todavía no está
// publicada (el BCU la actualiza a media mañana) o cae fin de semana, se
// pide un rango de varios días atrás y se toma la última fecha que vino.
export async function consultarCotizacionDolarBcu(): Promise<CotizacionBcu> {
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 6 * 24 * 60 * 60 * 1000);

  const sobre = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <wsbcucotizaciones.Execute xmlns="Cotiza">
      <Entrada>
        <Moneda><item>${MONEDA_DOLAR_BILLETE}</item></Moneda>
        <FechaDesde>${fechaIso(desde)}</FechaDesde>
        <FechaHasta>${fechaIso(hoy)}</FechaHasta>
        <Grupo>2</Grupo>
      </Entrada>
    </wsbcucotizaciones.Execute>
  </soap:Body>
</soap:Envelope>`;

  let xml: string;
  try {
    const res = await fetch(BCU_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "Cotizaaction/AWSBCUCOTIZACIONES.Execute" },
      body: sobre,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new ErrorConsultaBcu(`El BCU respondió ${res.status}.`);
    xml = await res.text();
  } catch (error) {
    if (error instanceof ErrorConsultaBcu) throw error;
    throw new ErrorConsultaBcu("No se pudo conectar con el BCU. Probá de nuevo en un momento.");
  }

  // Parseo por regex, no un XML parser de propósito general: el formato de
  // esta única respuesta es fijo y conocido, y no vale la pena una
  // dependencia nueva para esto.
  const bloques = Array.from(xml.matchAll(/<datoscotizaciones\.dato[^>]*>([\s\S]*?)<\/datoscotizaciones\.dato>/g));
  if (bloques.length === 0) throw new ErrorConsultaBcu("El BCU no devolvió cotizaciones para el dólar en estos días.");

  const campo = (bloque: string, tag: string) => bloque.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

  // Puede haber una fila por día del rango — se queda con la más reciente.
  let mejor: { fecha: string; compra: number; venta: number } | null = null;
  for (const [, bloque] of bloques) {
    const fecha = campo(bloque, "Fecha");
    const tcc = campo(bloque, "TCC");
    const tcv = campo(bloque, "TCV");
    if (!fecha || !tcc || !tcv) continue;
    if (!mejor || fecha > mejor.fecha) mejor = { fecha, compra: Number(tcc), venta: Number(tcv) };
  }

  if (!mejor) throw new ErrorConsultaBcu("El BCU no devolvió cotizaciones para el dólar en estos días.");
  return mejor;
}
