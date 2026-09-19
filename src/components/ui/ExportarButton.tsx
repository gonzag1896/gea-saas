"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Dropdown, DropdownItem } from "./Dropdown";

// Botón reutilizado por Ventas, Compras, Cuenta Corriente y Movimiento de
// Stock — descarga vía navegación directa a /api/reportes/<reporte>, que
// ya trae el permiso "ver" del módulo chequeado del lado del servidor.
export function ExportarButton({ reporte }: { reporte: string }) {
  function descargar(formato: "xlsx" | "pdf") {
    window.location.href = `/api/reportes/${reporte}?formato=${formato}`;
  }

  return (
    <Dropdown
      trigger={
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
          <Download className="h-4 w-4" /> Exportar
        </span>
      }
    >
      <DropdownItem onClick={() => descargar("xlsx")}>
        <FileSpreadsheet className="h-4 w-4 text-success" /> Excel (.xlsx)
      </DropdownItem>
      <DropdownItem onClick={() => descargar("pdf")}>
        <FileText className="h-4 w-4 text-danger" /> PDF
      </DropdownItem>
    </Dropdown>
  );
}
