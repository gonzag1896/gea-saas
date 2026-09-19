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

type Opcion = { id: string; nombre?: string; codigo?: string; codigoBarras?: string | null; descripcion?: string; moneda?: "UYU" | "USD"; precioVenta?: string; listaPrecioId?: string | null; stockActual?: number };
type Linea = { productoId: string; cantidad: string; precio: string; descuento: string; moneda: "UYU" | "USD" };

const ETIQUETA_MEDIO_PAGO: Record<"CONTADO" | "CREDITO" | "TRANSFERENCIA", string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito (cuenta corriente)",
  TRANSFERENCIA: "Transferencia",
};

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VentaFormClient({
  clientes,
  productos,
  preciosPorLista = {},
  cotizacionDolar,
}: {
  clientes: Opcion[];
  productos: Opcion[];
  preciosPorLista?: Record<string, Record<string, string>>;
  cotizacionDolar?: string | null;
}) {
  const router = useRouter();
  const cotizacion = cotizacionDolar ? Number(cotizacionDolar) : null;
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPago, setMedioPago] = useState<"CONTADO" | "CREDITO" | "TRANSFERENCIA">("CONTADO");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({
    productoId: productos[0]?.id ?? "", cantidad: "1", precio: "", descuento: "0", moneda: productos[0]?.moneda ?? "UYU",
  });
  const [codigoEscaneado, setCodigoEscaneado] = useState("");
  const [errorEscaneo, setErrorEscaneo] = useState<string | null>(null);
  const inputEscaneoRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.precio) return;
    if (lineaActual.moneda === "USD" && !cotizacion) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", precio: "", descuento: "0" });
  }

  // Precio de partida para un producto según la lista asignada al
  // cliente elegido — si el cliente no tiene lista, o la lista no tiene
  // un precio cargado para ese producto en particular, cae al precio
  // base del producto. Siempre queda editable a mano después.
  function precioSugerido(idProducto: string, idCliente: string = clienteId) {
    const cliente = clientes.find((c) => c.id === idCliente);
    const producto = productos.find((p) => p.id === idProducto);
    const porLista = cliente?.listaPrecioId ? preciosPorLista[cliente.listaPrecioId]?.[idProducto] : undefined;
    return porLista ?? producto?.precioVenta ?? "";
  }

  function tienePrecioDeLista(idProducto: string) {
    const cliente = clientes.find((c) => c.id === clienteId);
    return !!cliente?.listaPrecioId && preciosPorLista[cliente.listaPrecioId]?.[idProducto] !== undefined;
  }

  // Un lector de código de barras USB actúa como teclado: tipea el código
  // y manda un Enter solo — no hace falta hardware ni permiso especial,
  // alcanza con que el campo tenga el foco cuando se escanea. Por
  // onKeyDown y no un <form> propio: este campo ya vive adentro del
  // <form> de toda la venta, y un <form> anidado es HTML inválido — el
  // navegador lo aplana y el Enter termina mandando el formulario entero.
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
    setLineas((prev) => [...prev, { productoId: producto.id, cantidad: "1", precio: precioSugerido(producto.id) || "0", descuento: "0", moneda: producto.moneda ?? "UYU" }]);
    setCodigoEscaneado("");
    inputEscaneoRef.current?.focus();
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  // Las líneas ya agregadas quedan editables acá — sobre todo la cantidad:
  // antes, escanear el mismo producto 10 veces era la única forma de
  // vender 10 unidades. Ahora se escanea (o agrega) una vez y se corrige
  // la cantidad acá mismo.
  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas(lineas.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  async function crearVenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    setGuardando(true);

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        fecha: new Date(fecha).toISOString(),
        medioPago,
        // El backend siempre guarda en pesos — una línea en dólares se
        // convierte acá con la cotización configurada antes de mandarla.
        detalle: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          precio: l.moneda === "USD" ? Number(l.precio) * (cotizacion ?? 0) : Number(l.precio),
          descuento: Number(l.descuento),
        })),
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    router.push("/ventas");
    router.refresh();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  function totalLinea(l: Linea) {
    return Number(l.cantidad) * Number(l.precio) * (1 - Number(l.descuento || 0) / 100);
  }

  function totalLineaPesos(l: Linea) {
    const monto = totalLinea(l);
    return l.moneda === "USD" ? monto * (cotizacion ?? 0) : monto;
  }

  const subtotal = lineas.reduce((acc, l) => acc + totalLineaPesos(l), 0);

  if (clientes.length === 0 || productos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Nueva venta" />
        <Alert variant="info">Necesitás al menos un cliente y un producto cargados para registrar una venta.</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nueva venta" description="Registrá una venta a cliente. El stock se actualiza al confirmarla." />

      <form onSubmit={crearVenta} className="flex flex-col gap-6">
        <Card className="max-w-3xl">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Datos de la venta</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Cliente" required>
              <Select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  // Cambiar de cliente puede cambiar la lista de precio
                  // aplicable — si ya hay un producto elegido en la línea
                  // en curso, se re-sugiere el precio para el cliente nuevo.
                  if (lineaActual.productoId) {
                    setLineaActual((l) => ({ ...l, precio: precioSugerido(l.productoId, e.target.value) }));
                  }
                }}
              >
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </FormField>
            <FormField label="Medio de pago" required>
              <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}>
                {Object.entries(ETIQUETA_MEDIO_PAGO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
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
              <ScanBarcode className="h-3.5 w-3.5" /> Agrega la línea directo, con el precio de venta actual del producto.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <FormField label="O elegí el producto manualmente">
              <ProductoAutocomplete
                productos={productos}
                value={lineaActual.productoId}
                onChange={(id) => setLineaActual({ ...lineaActual, productoId: id, precio: precioSugerido(id), moneda: productos.find((p) => p.id === id)?.moneda ?? "UYU" })}
              />
            </FormField>
            {(() => {
              const p = productos.find((prod) => prod.id === lineaActual.productoId);
              const cantidad = Number(lineaActual.cantidad || 0);
              if (!p || p.stockActual === undefined || cantidad <= p.stockActual) return null;
              return (
                <p className="-mt-2 text-xs text-warning">
                  Stock disponible: {p.stockActual}. La venta se puede registrar igual, el stock queda negativo.
                </p>
              );
            })()}
            {lineaActual.moneda === "USD" && !cotizacion && (
              <p className="-mt-2 text-xs text-danger">
                Este producto está en dólares pero no hay una cotización configurada. Cargala en{" "}
                <a href="/configuracion" className="underline underline-offset-2">Configuración</a> para poder agregarlo.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <FormField label="Cantidad">
                <Input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} />
              </FormField>
              <FormField label={`${tienePrecioDeLista(lineaActual.productoId) ? "Precio unitario (lista del cliente)" : "Precio unitario"} (${lineaActual.moneda === "USD" ? "US$" : "$"})`}>
                <Input type="number" step="0.01" min="0" value={lineaActual.precio} onChange={(e) => setLineaActual({ ...lineaActual, precio: e.target.value })} placeholder={lineaActual.moneda === "USD" ? "US$" : "$"} />
              </FormField>
              <FormField label="Descuento %">
                <Input type="number" step="0.01" min="0" max="100" value={lineaActual.descuento} onChange={(e) => setLineaActual({ ...lineaActual, descuento: e.target.value })} placeholder="%" />
              </FormField>
              <Button type="button" variant="secondary" onClick={agregarLinea} className="h-9" disabled={lineaActual.moneda === "USD" && !cotizacion}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {lineas.length === 0 ? (
              <EmptyState message="Todavía no agregaste ningún producto a esta venta." />
            ) : (
              <>
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeadCell>Producto</Table.HeadCell>
                      <Table.HeadCell>Cantidad</Table.HeadCell>
                      <Table.HeadCell>Precio unitario</Table.HeadCell>
                      <Table.HeadCell>Descuento %</Table.HeadCell>
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
                              type="number" step="0.01" min="0" value={l.precio}
                              onChange={(e) => actualizarLinea(i, { precio: e.target.value })}
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
                        <Table.Cell className="font-mono tabular-nums">
                          $ {formatoMoneda(totalLineaPesos(l))}
                          {l.moneda === "USD" && <div className="text-xs font-normal text-muted-foreground">US$ {formatoMoneda(totalLinea(l))}</div>}
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
                  Subtotal: <span className="font-mono font-semibold tabular-nums text-foreground">$ {formatoMoneda(subtotal)}</span>
                </p>
              </>
            )}
          </div>
        </Card>

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" loading={guardando}>Registrar venta</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/ventas")}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}
