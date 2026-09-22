"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductoAutocomplete } from "@/components/ui/ProductoAutocomplete";

type Opcion = { id: string; nombre?: string; codigo?: string; codigoBarras?: string | null; descripcion?: string; moneda?: "UYU" | "USD"; stockActual?: number };
type Linea = { productoId: string; cantidad: string; costoUnitario: string; descuento: string; tipoIva: "EXENTO" | "TOTAL"; moneda: "UYU" | "USD" };

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Subtotal en la moneda propia de la línea (la del producto) — lo que se
// ve al cargar. El total de la compra, en cambio, siempre se expresa en
// pesos (ver subtotalLineaPesos), porque es lo que se guarda y lo que
// entra a cuenta corriente si la compra es a crédito.
function subtotalLinea(l: Linea) {
  return Number(l.cantidad) * Number(l.costoUnitario) * (1 - Number(l.descuento || 0) / 100);
}

function subtotalLineaPesos(l: Linea, cotizacion: number | null) {
  const monto = subtotalLinea(l);
  return l.moneda === "USD" ? monto * (cotizacion ?? 0) : monto;
}

export function CompraFormClient({
  proveedores,
  productos,
  cotizacionDolar,
}: {
  proveedores: Opcion[];
  productos: Opcion[];
  cotizacionDolar?: string | null;
}) {
  const router = useRouter();
  const cotizacion = cotizacionDolar ? Number(cotizacionDolar) : null;
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [numeroFactura, setNumeroFactura] = useState("");
  const [medioPago, setMedioPago] = useState<"CONTADO" | "CREDITO" | "DEBITO">("CONTADO");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({
    productoId: productos[0]?.id ?? "", cantidad: "1", costoUnitario: "", descuento: "0", tipoIva: "EXENTO",
    moneda: productos[0]?.moneda ?? "UYU",
  });
  const [codigoEscaneado, setCodigoEscaneado] = useState("");
  const [errorEscaneo, setErrorEscaneo] = useState<string | null>(null);
  const inputEscaneoRef = useRef<HTMLInputElement>(null);
  const inputCostoRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.costoUnitario) return;
    if (lineaActual.moneda === "USD" && !cotizacion) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", costoUnitario: "", descuento: "0" });
  }

  // A diferencia de Ventas, acá el escaneo no agrega la línea solo:
  // el costo de una compra varía por compra, no hay un "precio actual"
  // para autocompletar — el escaneo elige el producto y pasa el foco al
  // costo unitario para que se escriba y se confirme con "Agregar".
  function escanear() {
    const codigo = codigoEscaneado.trim();
    if (!codigo) return;

    const producto = productos.find((p) => p.codigoBarras === codigo);
    if (!producto) {
      setErrorEscaneo(`Ningún producto tiene el código de barras "${codigo}".`);
      setCodigoEscaneado("");
      return;
    }

    setErrorEscaneo(null);
    setLineaActual((prev) => ({ ...prev, productoId: producto.id, moneda: producto.moneda ?? "UYU" }));
    setCodigoEscaneado("");
    inputCostoRef.current?.focus();
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas(lineas.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  async function crearCompra(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    setGuardando(true);

    const res = await fetch("/api/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorId,
        fecha: new Date(fecha).toISOString(),
        numeroFactura: numeroFactura || undefined,
        medioPago,
        // El backend siempre guarda en pesos — una línea en dólares se
        // convierte acá con la cotización configurada antes de mandarla.
        detalle: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          costoUnitario: l.moneda === "USD" ? Number(l.costoUnitario) * (cotizacion ?? 0) : Number(l.costoUnitario),
          descuento: Number(l.descuento || 0),
          tipoIva: l.tipoIva,
        })),
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    router.push("/compras");
    router.refresh();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  const subtotal = lineas.reduce((acc, l) => acc + subtotalLineaPesos(l, cotizacion), 0);

  if (proveedores.length === 0 || productos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Nueva compra" />
        <Alert variant="info">Necesitás al menos un proveedor y un producto cargados para registrar una compra.</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nueva compra" description="Registrá una compra a proveedor. El stock se actualiza al confirmarla." />

      <form onSubmit={crearCompra} className="flex flex-col gap-6">
        <Card className="max-w-3xl">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Datos de la compra</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Proveedor" required>
              <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </FormField>
            <FormField label="N° de factura">
              <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Opcional" />
            </FormField>
            <FormField label="Medio de pago" required>
              <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as "CONTADO" | "CREDITO" | "DEBITO")}>
                <option value="CONTADO">Contado (no genera deuda)</option>
                <option value="DEBITO">Débito (no genera deuda)</option>
                <option value="CREDITO">Crédito (queda en cuenta corriente)</option>
              </Select>
            </FormField>
          </div>
        </Card>

        <Card className="max-w-3xl">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Agregar productos</h3>

          <div className="mb-4 flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-3">
            <FormField label="Escanear código de barras">
              <Input
                ref={inputEscaneoRef}
                value={codigoEscaneado}
                onChange={(e) => setCodigoEscaneado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  escanear();
                }}
                placeholder="Hacé clic acá y escaneá, o tipeá el código y Enter"
                autoFocus
              />
            </FormField>
            {errorEscaneo && <p className="text-sm text-danger">{errorEscaneo}</p>}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ScanBarcode className="h-3.5 w-3.5" /> Elige el producto — completá el costo unitario y tocá Agregar.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <FormField label="Producto">
              <ProductoAutocomplete
                productos={productos}
                value={lineaActual.productoId}
                onChange={(id) => setLineaActual({ ...lineaActual, productoId: id, moneda: productos.find((p) => p.id === id)?.moneda ?? "UYU" })}
              />
            </FormField>
            {lineaActual.moneda === "USD" && !cotizacion && (
              <p className="-mt-2 text-xs text-danger">
                Este producto está en dólares pero no hay una cotización configurada. Cargala en{" "}
                <a href="/configuracion" className="underline underline-offset-2">Configuración</a> para poder agregarlo.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
              <FormField label="Cantidad">
                <Input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} />
              </FormField>
              <FormField label={`Costo unitario (${lineaActual.moneda === "USD" ? "US$" : "$"})`}>
                <Input ref={inputCostoRef} type="number" step="0.01" min="0" value={lineaActual.costoUnitario} onChange={(e) => setLineaActual({ ...lineaActual, costoUnitario: e.target.value })} placeholder={lineaActual.moneda === "USD" ? "US$" : "$"} />
              </FormField>
              <FormField label="Descuento %">
                <Input type="number" step="0.01" min="0" max="100" value={lineaActual.descuento} onChange={(e) => setLineaActual({ ...lineaActual, descuento: e.target.value })} placeholder="%" />
              </FormField>
              <FormField label="IVA">
                <Select value={lineaActual.tipoIva} onChange={(e) => setLineaActual({ ...lineaActual, tipoIva: e.target.value as "EXENTO" | "TOTAL" })}>
                  <option value="EXENTO">Exento</option>
                  <option value="TOTAL">22%</option>
                </Select>
              </FormField>
              <Button type="button" variant="secondary" onClick={agregarLinea} className="h-9" disabled={lineaActual.moneda === "USD" && !cotizacion}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {lineas.length === 0 ? (
              <EmptyState message="Todavía no agregaste ningún producto a esta compra." />
            ) : (
              <>
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeadCell>Producto</Table.HeadCell>
                      <Table.HeadCell>Cantidad</Table.HeadCell>
                      <Table.HeadCell>Costo unitario</Table.HeadCell>
                      <Table.HeadCell>Descuento %</Table.HeadCell>
                      <Table.HeadCell>IVA</Table.HeadCell>
                      <Table.HeadCell>Subtotal</Table.HeadCell>
                      <Table.HeadCell />
                    </Table.Row>
                  </Table.Head>
                  <tbody>
                    {lineas.map((l, i) => (
                      <Table.Row key={i}>
                        <Table.Cell>{nombreProducto(l.productoId)}</Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number" min="1" value={l.cantidad}
                            onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                            className="w-20"
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{l.moneda === "USD" ? "US$" : "$"}</span>
                            <Input
                              type="number" step="0.01" min="0" value={l.costoUnitario}
                              onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                              className="w-24"
                            />
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            type="number" step="0.01" min="0" max="100" value={l.descuento}
                            onChange={(e) => actualizarLinea(i, { descuento: e.target.value })}
                            className="w-20"
                          />
                        </Table.Cell>
                        <Table.Cell>{l.tipoIva === "TOTAL" ? "22%" : "Exento"}</Table.Cell>
                        <Table.Cell className="font-mono tabular-nums">
                          $ {formatoMoneda(subtotalLineaPesos(l, cotizacion))}
                          {l.moneda === "USD" && <div className="text-xs font-normal text-muted-foreground">US$ {formatoMoneda(subtotalLinea(l))}</div>}
                        </Table.Cell>
                        <Table.Cell>
                          <Button type="button" variant="icon" className="h-8 w-8" aria-label="Quitar línea" onClick={() => quitarLinea(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </tbody>
                </Table>
                <p className="mt-3 text-right text-sm text-muted-foreground">
                  Subtotal sin IVA: <span className="font-mono font-semibold tabular-nums text-foreground">$ {formatoMoneda(subtotal)}</span>
                </p>
              </>
            )}
          </div>
        </Card>

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" loading={guardando}>Registrar compra</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/compras")}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
