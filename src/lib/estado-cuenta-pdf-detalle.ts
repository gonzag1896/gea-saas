import { formatearDia, formatearMonto, simboloMoneda, type armarDetalleCompras } from "@/lib/estado-cuenta";

const AZUL = "#0067B8";
const GRIS = "#64748b";

type Detalle = ReturnType<typeof armarDetalleCompras>;

// Segunda parte del estado de cuenta de un cliente: el detalle de lo que
// compró. Cada venta lista sus líneas y sus totales; la suma por moneda cierra
// contra los cargos (Debe) del estado de cuenta del mismo período.
export function dibujarDetalleCompras(
  doc: PDFKit.PDFDocument,
  datos: { nombreCliente: string; textoPeriodo: string },
  detalle: Detalle,
) {
  doc.addPage();
  doc.fontSize(18).fillColor(AZUL).text("Detalle de compras");
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#111827").text(datos.nombreCliente);
  doc.fontSize(9).fillColor(GRIS).text(`Período: ${datos.textoPeriodo}`);
  doc.fontSize(8.5).text("Ventas con cargo en el estado de cuenta de este período. Los importes totales coinciden con la columna Debe.");
  doc.moveDown(0.8);

  if (detalle.compras.length === 0) {
    doc.fontSize(10).fillColor(GRIS).text("No hay compras en el período.");
  }

  for (const compra of detalle.compras) {
    // Que el encabezado de una venta no quede solo al pie de una página.
    if (doc.y > doc.page.height - 170) doc.addPage();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(
      `N.° ${compra.numero}  ·  ${formatearDia(compra.fecha)}  ·  ${compra.medioPago}${compra.anulada ? "  ·  ANULADA" : ""}`,
    );
    doc.font("Helvetica").moveDown(0.3);

    const filas: string[][] = [["Código", "Descripción", "Cant.", "Precio", "Dto.", "IVA", "Importe"]];
    for (const l of compra.lineas) {
      const sim = simboloMoneda(l.moneda);
      filas.push([
        l.codigo,
        l.devuelta > 0 ? `${l.descripcion} (devueltas: ${l.devuelta})` : l.descripcion,
        String(l.cantidad),
        `${sim} ${formatearMonto(l.precio)}`,
        l.descuento > 0 ? `${l.descuento}%` : "",
        l.iva ? "22%" : "Exento",
        `${sim} ${formatearMonto(l.importe)}`,
      ]);
    }
    const primeraFilaTotales = filas.length;
    for (const t of compra.totales) {
      const sim = simboloMoneda(t.moneda);
      filas.push(["", "Subtotal", "", "", "", "", `${sim} ${formatearMonto(t.subtotal)}`]);
      if (t.iva > 0) filas.push(["", "IVA 22%", "", "", "", "", `${sim} ${formatearMonto(t.iva)}`]);
      filas.push(["", "Total", "", "", "", "", `${sim} ${formatearMonto(t.total)}`]);
    }

    doc.fontSize(7.5).fillColor("#111827");
    doc.table({
      defaultStyle: { border: 0.5, borderColor: "#CBD5E1" },
      columnStyles: [
        { width: 56 },
        { width: 187 },
        { width: 34, align: { x: "right" } },
        { width: 70, align: { x: "right" } },
        { width: 36, align: { x: "right" } },
        { width: 40, align: { x: "center" } },
        { width: 100, align: { x: "right" } },
      ],
      rowStyles: (fila: number) =>
        fila === 0
          ? { backgroundColor: AZUL, textColor: "#FFFFFF", padding: 4 }
          : fila >= primeraFilaTotales
            ? { backgroundColor: filas[fila][1] === "Total" ? "#E2E8F0" : "#F8FAFC", padding: 4 }
            : { padding: 4 },
      data: filas,
    });
    doc.moveDown(1);
  }

  if (detalle.compras.length > 0) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.fontSize(10).fillColor("#111827").font("Helvetica-Bold").text("Total de compras del período");
    doc.font("Helvetica");
    for (const moneda of ["UYU", "USD"] as const) {
      if (detalle.totalEstado[moneda] === 0 && detalle.totalDetalle[moneda] === 0) continue;
      doc.fontSize(10).text(`${simboloMoneda(moneda)} ${formatearMonto(detalle.totalEstado[moneda])}`);
    }
    doc.fontSize(8.5).fillColor(detalle.cierra ? GRIS : "#B91C1C").text(
      detalle.cierra
        ? "Coincide con los cargos por ventas (Debe) del estado de cuenta."
        : "Atención: el detalle no coincide con el estado de cuenta. Revisar antes de enviar.",
    );
  }
}
