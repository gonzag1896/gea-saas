import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatearFechaHoyUruguay } from "@/lib/fecha";

export type ColumnaReporte<T> = {
  header: string;
  value: (row: T) => string | number;
  anchoExcel?: number;
  anchoPdf?: number | string;
  alineacion?: "left" | "right" | "center";
};

// Azul de marca (Design System GEA v2) para el encabezado — mismo tono que
// --color-primary en globals.css, así el reporte se siente parte de la
// misma identidad aunque se genere fuera del navegador.
const AZUL_GEA = "0067B8";

export async function generarExcel<T>(nombreHoja: string, columnas: ColumnaReporte<T>[], filas: T[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "GEA";
  libro.created = new Date();

  const hoja = libro.addWorksheet(nombreHoja);
  hoja.columns = columnas.map((c) => ({ header: c.header, width: c.anchoExcel ?? 22 }));

  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AZUL_GEA}` } };
  filaEncabezado.alignment = { vertical: "middle" };

  for (const fila of filas) {
    hoja.addRow(columnas.map((c) => c.value(fila)));
  }

  columnas.forEach((c, i) => {
    if (c.alineacion) hoja.getColumn(i + 1).alignment = { horizontal: c.alineacion };
  });

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generarPdf<T>(
  titulo: string,
  subtitulo: string | undefined,
  columnas: ColumnaReporte<T>[],
  filas: T[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const apaisado = columnas.length > 5;
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: apaisado ? "landscape" : "portrait" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#111827").text(titulo);
    if (subtitulo) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor("#64748b").text(subtitulo);
    }
    doc.moveDown(0.8);

    const encabezado: string[] = columnas.map((c) => c.header);
    const datos = filas.map((fila) => columnas.map((c) => String(c.value(fila))));

    doc.table({
      columnStyles: columnas.map((c) => ({
        width: c.anchoPdf,
        align: c.alineacion === "center" ? "center" as const : c.alineacion ? { x: c.alineacion } : undefined,
      })),
      rowStyles: (fila: number) =>
        fila === 0
          ? { backgroundColor: `#${AZUL_GEA}`, textColor: "#FFFFFF", padding: 6 }
          : fila % 2 === 0
            ? { backgroundColor: "#F8FAFC", padding: 6 }
            : { padding: 6 },
      data: [encabezado, ...datos],
    });

    if (filas.length === 0) {
      doc.moveDown();
      doc.fontSize(10).fillColor("#64748b").text("No hay datos para este reporte.");
    }

    doc.end();
  });
}

// Lista de precios "para el mostrador": a diferencia de generarPdf (uso
// interno, sin membrete), este PDF lo recibe el cliente final — lleva el
// logo y el nombre de la ferretería como encabezado y solo las columnas
// que le sirven a quien compra (nunca costo ni stock). Paginado automático:
// doc.table() de pdfkit ya corta de página sola cuando el contenido
// desborda, no hace falta manejarlo a mano acá.
export async function generarListaPreciosPdf<T>(
  ferreteriaNombre: string,
  tituloLista: string,
  columnas: ColumnaReporte<T>[],
  filas: T[],
): Promise<Buffer> {
  // Se lee antes de abrir la Promise del PDF: un executor `async` no
  // propaga bien sus rechazos al `reject` de afuera, así que toda espera
  // asincrónica pasa acá, antes de que arranque el documento.
  const logo = await readFile(path.join(process.cwd(), "public", "logo-gea.png")).catch(() => null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (logo) {
      doc.image(logo, doc.page.width / 2 - 60, doc.y, { width: 120 });
      doc.moveDown(3.5);
    }

    doc.fontSize(15).fillColor("#111827").text(ferreteriaNombre, { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(18).fillColor("#0067B8").text(tituloLista, { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor("#64748b").text(`Lista de precios vigente al ${formatearFechaHoyUruguay()}`, { align: "center" });
    doc.moveDown(1.2);

    const encabezado: string[] = columnas.map((c) => c.header);
    const datos = filas.map((fila) => columnas.map((c) => String(c.value(fila))));

    doc.table({
      columnStyles: columnas.map((c) => ({
        width: c.anchoPdf,
        align: c.alineacion === "center" ? ("center" as const) : c.alineacion ? { x: c.alineacion } : undefined,
      })),
      rowStyles: (fila: number) =>
        fila === 0
          ? { backgroundColor: "#0067B8", textColor: "#FFFFFF", padding: 6 }
          : fila % 2 === 0
            ? { backgroundColor: "#F8FAFC", padding: 6 }
            : { padding: 6 },
      data: [encabezado, ...datos],
    });

    if (filas.length === 0) {
      doc.moveDown();
      doc.fontSize(10).fillColor("#64748b").text("Esta lista todavía no tiene precios cargados.");
    }

    // Numeración de página al pie — el pedido puntual de "paginado".
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#94a3b8").text(`Página ${i + 1} de ${paginas.count}`, 0, doc.page.height - 30, { align: "center" });
    }

    doc.end();
  });
}

export function nombreArchivo(base: string, formato: "xlsx" | "pdf") {
  const fecha = new Date().toISOString().slice(0, 10);
  return `${base}-${fecha}.${formato}`;
}

const CONTENT_TYPE: Record<"xlsx" | "pdf", string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

// Punto único que usan las cuatro rutas de /api/reportes/*: arma el mismo
// Excel o PDF a partir de la misma definición de columnas, y responde con
// los headers de descarga correctos — así ningún reporte nuevo tiene que
// reinventar el manejo de ?formato= ni el Content-Disposition.
export async function responderReporte<T>(
  formatoParam: string | null,
  base: string,
  titulo: string,
  subtitulo: string | undefined,
  columnas: ColumnaReporte<T>[],
  filas: T[],
): Promise<NextResponse> {
  const formato: "xlsx" | "pdf" = formatoParam === "pdf" ? "pdf" : "xlsx";
  const buffer = formato === "pdf"
    ? await generarPdf(titulo, subtitulo, columnas, filas)
    : await generarExcel(titulo, columnas, filas);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPE[formato],
      "Content-Disposition": `attachment; filename="${nombreArchivo(base, formato)}"`,
    },
  });
}
