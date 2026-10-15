import PDFDocument from "pdfkit";
import { formatearDia, formatearMonto, simboloMoneda, type Moneda, type TipoCuenta } from "@/lib/estado-cuenta";

export type DatosReciboPdf = {
  tipo: TipoCuenta;
  numero: string;
  fecha: string; // YYYY-MM-DD
  ferreteria: { nombre: string; razonSocial: string | null; rut: string | null; telefono: string | null; direccion: string | null };
  entidad: { nombre: string; rut: string | null };
  monedaDeuda: Moneda; // moneda de la deuda que se cancela
  importeAplicado: number; // lo que bajó la deuda, en monedaDeuda
  recibido: { moneda: Moneda; importe: number; cotizacion: number | null }; // lo que efectivamente se entregó
  medioPago: string;
  referencia: string | null;
  saldoDespues: number; // saldo de monedaDeuda luego de este movimiento
  anuladoEl: string | null; // YYYY-MM-DD si el movimiento fue anulado
};

const AZUL = "#0067B8";
const GRIS = "#64748b";

function leyendaSaldo(tipo: TipoCuenta, saldo: number): string {
  if (saldo === 0) return "Sin saldo pendiente";
  if (tipo === "cliente") return saldo > 0 ? "Saldo pendiente del cliente" : "Saldo a favor del cliente";
  return saldo > 0 ? "Saldo pendiente con el proveedor" : "Saldo a nuestro favor";
}

export function generarReciboPdf(d: DatosReciboPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const esCobro = d.tipo === "cliente";
    const titulo = esCobro ? "Recibo de cobro" : "Comprobante de pago";
    const doc = new PDFDocument({ margin: 40, size: "A4", info: { Title: `${titulo} ${d.numero}`, Author: d.ferreteria.nombre } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ancho = doc.page.width - 80;
    const x0 = 40;

    // Membrete
    doc.fontSize(15).fillColor("#111827").text(d.ferreteria.razonSocial || d.ferreteria.nombre, x0, 40);
    const datosFerreteria = [d.ferreteria.rut && `RUT ${d.ferreteria.rut}`, d.ferreteria.direccion, d.ferreteria.telefono && `Tel. ${d.ferreteria.telefono}`].filter(Boolean).join("  ·  ");
    if (datosFerreteria) doc.fontSize(8.5).fillColor(GRIS).text(datosFerreteria);

    // Título y número
    const yTitulo = doc.y + 18;
    doc.fontSize(20).fillColor(AZUL).text(titulo, x0, yTitulo);
    doc.fontSize(11).fillColor("#111827").text(`N° ${d.numero}`, x0, yTitulo + 4, { width: ancho, align: "right" });
    doc.fontSize(9).fillColor(GRIS).text(`Fecha: ${formatearDia(d.fecha)}`, x0, yTitulo + 20, { width: ancho, align: "right" });

    doc.moveTo(x0, yTitulo + 36).lineTo(x0 + ancho, yTitulo + 36).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

    // Destinatario
    doc.fontSize(9).fillColor(GRIS).text(esCobro ? "Recibimos de" : "Pagamos a", x0, yTitulo + 48);
    doc.fontSize(13).fillColor("#111827").text(d.entidad.nombre);
    if (d.entidad.rut) doc.fontSize(9).fillColor(GRIS).text(`RUT ${d.entidad.rut}`);

    // Importe
    const yImporte = doc.y + 16;
    doc.rect(x0, yImporte, ancho, 52).fillColor("#F1F5F9").fill();
    doc.fontSize(9).fillColor(GRIS).text(esCobro ? "Importe recibido" : "Importe pagado", x0 + 14, yImporte + 9);
    doc.fontSize(20).fillColor("#111827").text(`${simboloMoneda(d.recibido.moneda)} ${formatearMonto(d.recibido.importe)}`, x0 + 14, yImporte + 22);

    // Detalle
    const filas: [string, string][] = [["Medio de pago", d.medioPago]];
    if (d.referencia) filas.push(["Referencia", d.referencia]);
    if (d.recibido.moneda !== d.monedaDeuda && d.recibido.cotizacion) {
      filas.push(["Cotización del dólar", formatearMonto(d.recibido.cotizacion)]);
      filas.push([esCobro ? "Cancela deuda por" : "Cancela deuda por", `${simboloMoneda(d.monedaDeuda)} ${formatearMonto(d.importeAplicado)}`]);
    }
    filas.push([esCobro ? "Saldo luego del cobro" : "Saldo luego del pago", `${simboloMoneda(d.monedaDeuda)} ${formatearMonto(d.saldoDespues)}  (${leyendaSaldo(d.tipo, d.saldoDespues)})`]);

    let y = yImporte + 52 + 18;
    for (const [etiqueta, valor] of filas) {
      doc.fontSize(9).fillColor(GRIS).text(etiqueta, x0, y, { width: 150 });
      doc.fontSize(10).fillColor("#111827").text(valor, x0 + 150, y - 1, { width: ancho - 150 });
      y = Math.max(doc.y, y + 16) + 4;
    }

    // Anulado
    if (d.anuladoEl) {
      y += 6;
      doc.rect(x0, y, ancho, 26).fillColor("#FEE2E2").fill();
      doc.fontSize(10).fillColor("#B91C1C").text(`Este ${esCobro ? "cobro" : "pago"} fue ANULADO el ${formatearDia(d.anuladoEl)}. Este documento no tiene validez.`, x0 + 12, y + 8, { width: ancho - 24 });
      y += 26;
    }

    // Firma
    const yFirma = Math.max(y + 60, 330);
    doc.moveTo(x0 + ancho - 190, yFirma).lineTo(x0 + ancho, yFirma).lineWidth(0.5).strokeColor("#94A3B8").stroke();
    doc.fontSize(8.5).fillColor(GRIS).text("Firma y aclaración", x0 + ancho - 190, yFirma + 4, { width: 190, align: "center" });

    doc.fontSize(8).fillColor("#94a3b8").text("Generado con GEA", x0, yFirma + 40, { width: ancho, align: "center" });

    doc.end();
  });
}
