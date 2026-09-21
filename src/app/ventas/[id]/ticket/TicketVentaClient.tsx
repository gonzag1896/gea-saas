"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { formatearFecha } from "@/lib/fecha";

type Linea = {
  id: string;
  cantidad: number;
  precio: string;
  totalVigente: string;
  producto: { codigo: string; descripcion: string };
};
type Venta = {
  id: string;
  fecha: Date;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  medioPago: string;
  tipoIva: "EXENTO" | "TOTAL";
  subtotal: string;
  iva: string;
  total: string;
  motivoAnulacion: string | null;
  cliente: { nombre: string; telefono: string | null };
  detalle: Linea[];
};
type Ferreteria = {
  nombre: string;
  razonSocial: string | null;
  rut: string | null;
  telefono: string | null;
  direccion: string | null;
};

const ETIQUETA_MEDIO_PAGO: Record<string, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

function formatoMoneda(n: string) {
  return Number(n).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TicketVentaClient({ venta, ferreteria }: { venta: Venta; ferreteria: Ferreteria }) {
  useEffect(() => {
    // El diálogo de impresión sale solo apenas carga la hoja — el cajero
    // no tiene que buscar un botón en el medio de atender al cliente.
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <style>{"@page { size: auto; margin: 10mm; }"}</style>

      <div className="mx-auto flex max-w-[380px] items-center justify-between px-1 pb-4 print:hidden">
        <a href={`/ventas/${venta.id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Volver
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <div className="mx-auto w-full max-w-[380px] bg-white p-5 text-[13px] text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="text-center">
          <p className="text-base font-bold">{ferreteria.nombre}</p>
          {ferreteria.razonSocial && <p className="text-xs text-gray-500">{ferreteria.razonSocial}</p>}
          {ferreteria.rut && <p className="text-xs text-gray-500">RUT: {ferreteria.rut}</p>}
          {ferreteria.direccion && <p className="text-xs text-gray-500">{ferreteria.direccion}</p>}
          {ferreteria.telefono && <p className="text-xs text-gray-500">Tel: {ferreteria.telefono}</p>}
        </div>

        <div className="my-3 border-t border-dashed border-gray-300" />

        <p className="text-center text-sm font-semibold">COMPROBANTE DE VENTA</p>
        <p className="text-center text-xs text-gray-500">N.° {venta.id.slice(-8).toUpperCase()}</p>

        {venta.estado === "ANULADO" && (
          <div className="my-2 border-2 border-red-600 py-1 text-center text-sm font-bold text-red-600">
            ANULADA
          </div>
        )}
        {venta.estado === "PENDIENTE" && (
          <div className="my-2 border border-orange-500 py-1 text-center text-xs font-medium text-orange-600">
            Pendiente de confirmación
          </div>
        )}

        <div className="my-3 border-t border-dashed border-gray-300" />

        <div className="flex flex-col gap-0.5 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span>{formatearFecha(venta.fecha)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Cliente</span><span className="text-right">{venta.cliente.nombre}</span></div>
          {venta.cliente.telefono && (
            <div className="flex justify-between"><span className="text-gray-500">Teléfono</span><span>{venta.cliente.telefono}</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">Medio de pago</span><span>{ETIQUETA_MEDIO_PAGO[venta.medioPago] ?? venta.medioPago}</span></div>
        </div>

        <div className="my-3 border-t border-dashed border-gray-300" />

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-1 text-left font-semibold">Producto</th>
              <th className="py-1 text-right font-semibold">Cant.</th>
              <th className="py-1 text-right font-semibold">Precio</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {venta.detalle.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-1 pr-1">{l.producto.descripcion}</td>
                <td className="py-1 text-right font-mono tabular-nums">{l.cantidad}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatoMoneda(l.precio)}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatoMoneda(l.totalVigente)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-gray-300" />

        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-mono tabular-nums">$ {formatoMoneda(venta.subtotal)}</span>
          </div>
          {venta.tipoIva === "TOTAL" && (
            <div className="flex justify-between">
              <span className="text-gray-500">IVA (22%)</span>
              <span className="font-mono tabular-nums">$ {formatoMoneda(venta.iva)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span className="font-mono tabular-nums">$ {formatoMoneda(venta.total)}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-gray-300" />

        <p className="text-center text-[11px] text-gray-400">
          Comprobante no válido como factura. Generado por GEA.
        </p>
      </div>
    </div>
  );
}
