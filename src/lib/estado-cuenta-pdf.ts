import PDFDocument from "pdfkit";
import { formatearFechaHoyUruguay } from "@/lib/fecha";
import { formatearDia, formatearMonto, simboloMoneda, type EstadoMoneda, type Periodo, type TipoCuenta } from "@/lib/estado-cuenta";

export type DatosEstadoCuentaPdf = {
  tipo: TipoCuenta;
  ferreteria: { nombre: string; razonSocial: string | null; rut: string | null; telefono: string | null; direccion: string | null };
  entidad: { nombre: string; rut: string | null; telefono: string | null };
  periodo: Periodo;
  estados: EstadoMoneda[]; // una sección por moneda
};

const AZUL = "#0067B8";
const GRIS_TEXTO = "#64748b";
const NOMBRE_MONEDA = { UYU: "pesos ($)", USD: "dólares (US$)" } as const;

function textoPeriodo(p: Periodo): string {
  if (p.desde && p.hasta) return `Del ${formatearDia(p.desde)} al ${formatearDia(p.hasta)}`;
  if (p.desde) return `Desde el ${formatearDia(p.desde)}`;
  if (p.hasta) return `Hasta el ${formatearDia(p.hasta)}`;
  return "Historial completo";
}

// "Debe" y "Haber" desde el punto de vista de la ferretería: lo que el
// cliente nos debe (Debe) y lo que nos pagó (Haber); en proveedores, al revés
// de quién debe a quién, pero la convención de columnas es la misma.
function leyendaSaldo(tipo: TipoCuenta, saldo: number): string {
  if (saldo === 0) return "Sin saldo";
  if (tipo === "cliente") return saldo > 0 ? "El cliente adeuda" : "Saldo a favor del cliente";
  return saldo > 0 ? "Adeudamos al proveedor" : "Saldo a nuestro favor";
}

export function generarEstadoCuentaPdf(datos: DatosEstadoCuentaPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", bufferPages: true, info: { Title: `Estado de cuenta - ${datos.entidad.nombre}`, Author: datos.ferreteria.nombre } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { ferreteria, entidad } = datos;
    const etiquetaEntidad = datos.tipo === "cliente" ? "Cliente" : "Proveedor";

    // Membrete
    doc.fontSize(15).fillColor("#111827").text(ferreteria.razonSocial || ferreteria.nombre);
    const datosFerreteria = [ferreteria.rut && `RUT ${ferreteria.rut}`, ferreteria.direccion, ferreteria.telefono && `Tel. ${ferreteria.telefono}`].filter(Boolean).join("  ·  ");
    if (datosFerreteria) doc.fontSize(8.5).fillColor(GRIS_TEXTO).text(datosFerreteria);
    doc.moveDown(0.8);

    doc.fontSize(18).fillColor(AZUL).text("Estado de cuenta");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#111827").text(`${etiquetaEntidad}: ${entidad.nombre}`);
    const datosEntidad = [entidad.rut && `RUT ${entidad.rut}`, entidad.telefono && `Tel. ${entidad.telefono}`].filter(Boolean).join("  ·  ");
    if (datosEntidad) doc.fontSize(9).fillColor(GRIS_TEXTO).text(datosEntidad);
    doc.fontSize(9).fillColor(GRIS_TEXTO).text(`Período: ${textoPeriodo(datos.periodo)}   ·   Emitido el ${formatearFechaHoyUruguay()}`);
    doc.moveDown(1);

    if (datos.estados.length === 0) {
      doc.fontSize(10).fillColor(GRIS_TEXTO).text("Todavía no hay movimientos registrados.");
    }

    for (const estado of datos.estados) {
      const simbolo = simboloMoneda(estado.moneda);
      doc.fontSize(11).fillColor("#111827").text(`Cuenta en ${NOMBRE_MONEDA[estado.moneda]}`);
      doc.moveDown(0.3);

      const hayAnterior = estado.saldoAnterior !== 0 || Boolean(datos.periodo.desde);
      const datosTabla: string[][] = [["Fecha", "Concepto", "Detalle", "Debe", "Haber", "Saldo"]];
      if (hayAnterior) datosTabla.push(["", "Saldo anterior", "", "", "", formatearMonto(estado.saldoAnterior)]);
      for (const f of estado.filas) {
        datosTabla.push([
          formatearDia(f.fecha),
          f.concepto,
          f.detalle,
          f.debe ? formatearMonto(f.debe) : "",
          f.haber ? formatearMonto(f.haber) : "",
          formatearMonto(f.saldo),
        ]);
      }
      datosTabla.push(["", "Totales", "", formatearMonto(estado.totalDebe), formatearMonto(estado.totalHaber), formatearMonto(estado.saldoFinal)]);
      const ultima = datosTabla.length - 1;

      doc.fontSize(8).fillColor("#111827");
      doc.table({
        // Líneas finas y claras: la tabla se lee por las columnas, no por la grilla.
        defaultStyle: { border: 0.5, borderColor: "#CBD5E1" },
        columnStyles: [
          { width: 54 },
          { width: 110 },
          { width: 139 },
          { width: 72, align: { x: "right" } },
          { width: 72, align: { x: "right" } },
          { width: 76, align: { x: "right" } },
        ],
        rowStyles: (fila: number) =>
          fila === 0
            ? { backgroundColor: AZUL, textColor: "#FFFFFF", padding: 5 }
            : fila === ultima
              ? { backgroundColor: "#E2E8F0", padding: 5 }
              : hayAnterior && fila === 1
                ? { backgroundColor: "#F1F5F9", padding: 5 }
                : { padding: 5 },
        data: datosTabla,
      });

      doc.moveDown(0.6);
      doc.fontSize(11).fillColor("#111827").text(`Saldo final: ${simbolo} ${formatearMonto(estado.saldoFinal)}`, { continued: true });
      doc.fontSize(9).fillColor(GRIS_TEXTO).text(`   ${leyendaSaldo(datos.tipo, estado.saldoFinal)}`);
      if (estado.filas.length === 0) {
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(GRIS_TEXTO).text("Sin movimientos en el período.");
      }
      doc.moveDown(1.2);
    }

    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior: sin esto pdfkit lo toma como
      // desborde y agrega una página en blanco al final.
      doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor("#94a3b8").text(`Página ${i + 1} de ${paginas.count}  ·  Generado con GEA`, 0, doc.page.height - 30, { align: "center" });
    }

    doc.end();
  });
}
