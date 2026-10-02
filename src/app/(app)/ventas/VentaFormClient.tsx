"use client";

import { useMemo, useRef, useState } from "react";
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
import { PromptDialog } from "@/components/ui/PromptDialog";
import { ProductoAutocomplete, type ProductoOpcion } from "@/components/ui/ProductoAutocomplete";
import { ordenarPorNombre } from "@/lib/ordenar";

type ClienteOpcion = { id: string; nombre: string; listaPrecioId: string | null };
type Linea = { productoId: string; nombre: string; cantidad: string; precio: string; descuento: string; tipoIva: "EXENTO" | "TOTAL"; moneda: "UYU" | "USD" };

const ETIQUETA_MEDIO_PAGO: Record<"CONTADO" | "CREDITO" | "TRANSFERENCIA" | "DEBITO", string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito (cuenta corriente)",
  TRANSFERENCIA: "Transferencia",
  DEBITO: "Débito",
};

function formatoMoneda(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VentaFormClient({
  clientes: clientesIniciales,
  hayProductos,
  cotizacionDolar,
}: {
  clientes: ClienteOpcion[];
  hayProductos: boolean;
  cotizacionDolar?: string | null;
}) {
  const router = useRouter();
  const cotizacion = cotizacionDolar ? Number(cotizacionDolar) : null;
  // Estado propio (no solo el prop) para poder sumarle el cliente que se
  // dé de alta rápida acá mismo, sin perder el resto de la venta en curso
  // con un router.refresh().
  const [clientes, setClientes] = useState(clientesIniciales);
  const clientesOrdenados = useMemo(() => ordenarPorNombre(clientes), [clientes]);
  const [clienteId, setClienteId] = useState(clientesIniciales[0]?.id ?? "");
  const [nuevoClienteAbierto, setNuevoClienteAbierto] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPago, setMedioPago] = useState<"CONTADO" | "CREDITO" | "TRANSFERENCIA" | "DEBITO">("CONTADO");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [productoActual, setProductoActual] = useState<ProductoOpcion | null>(null);
  const [lineaActual, setLineaActual] = useState<Linea>({
    productoId: "", nombre: "", cantidad: "1", precio: "", descuento: "0", tipoIva: "EXENTO", moneda: "UYU",
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
    // Limpia también el producto elegido: si quedaba precargado, después
    // de "Agregar" no quedaba claro que había que elegir uno nuevo antes
    // de volver a tocar "Agregar" (se corría el riesgo de duplicar la
    // línea sin querer).
    setProductoActual(null);
    setLineaActual({ productoId: "", nombre: "", cantidad: "1", precio: "", descuento: "0", tipoIva: "EXENTO", moneda: "UYU" });
  }

  // La lista de precio aplicable es la del cliente elegido: el servidor
  // devuelve el precio de esa lista si el producto tiene uno cargado, y si
  // no, el precio base. Siempre queda editable a mano después.
  const listaPrecioId = clientes.find((c) => c.id === clienteId)?.listaPrecioId ?? null;

  // Alta rápida de cliente sin salir de la venta en curso: solo el nombre
  // (mismos campos mínimos que /clientes/nuevo exige), el resto (RUT,
  // teléfono, email, dirección, lista de precio) se completa después
  // desde la ficha del cliente.
  async function crearCliente(nombre: string) {
    setCreandoCliente(true);
    setErrorCliente(null);
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    setCreandoCliente(false);
    if (!res.ok) {
      setErrorCliente((await res.json().catch(() => null))?.error ?? "No se pudo crear el cliente.");
      return;
    }
    const { cliente } = await res.json();
    setClientes((prev) => [...prev, cliente]);
    setClienteId(cliente.id);
    setNuevoClienteAbierto(false);
  }

  function elegirProducto(p: ProductoOpcion) {
    setProductoActual(p);
    setLineaActual((l) => ({ ...l, productoId: p.id, nombre: `${p.codigo} — ${p.descripcion}`, precio: p.precioVenta, moneda: p.moneda }));
  }

  // Un lector de código de barras USB actúa como teclado: tipea el código
  // y manda un Enter solo — no hace falta hardware ni permiso especial,
  // alcanza con que el campo tenga el foco cuando se escanea. Por
  // onKeyDown y no un <form> propio: este campo ya vive adentro del
  // <form> de toda la venta, y un <form> anidado es HTML inválido — el
  // navegador lo aplana y el Enter termina mandando el formulario entero.
  async function escanear() {
    const codigo = codigoEscaneado.trim();
    if (!codigo) return;

    const params = new URLSearchParams({ codigoBarras: codigo });
    if (listaPrecioId) params.set("listaPrecioId", listaPrecioId);
    const res = await fetch(`/api/productos/buscar?${params}`);
    const producto: ProductoOpcion | undefined = res.ok ? (await res.json()).productos[0] : undefined;
    if (!producto) {
      setErrorEscaneo(res.ok ? `Ningún producto tiene el código de barras "${codigo}".` : "No se pudo buscar el producto. Probá de nuevo.");
      setCodigoEscaneado("");
      return;
    }

    setErrorEscaneo(null);
    setLineas((prev) => [...prev, { productoId: producto.id, nombre: `${producto.codigo} — ${producto.descripcion}`, cantidad: "1", precio: producto.precioVenta || "0", descuento: "0", tipoIva: "EXENTO", moneda: producto.moneda }]);
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
        // Cada línea viaja en su propia moneda, sin convertir — el
        // servidor es quien calcula el total en pesos y el total en
        // dólares, cada uno sumando solo sus propias líneas.
        detalle: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          precio: Number(l.precio),
          moneda: l.moneda,
          cotizacion: l.moneda === "USD" ? cotizacion ?? undefined : undefined,
          descuento: Number(l.descuento),
          tipoIva: l.tipoIva,
        })),
      }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    router.push("/ventas");
    router.refresh();
  }

  function totalLinea(l: Linea) {
    return Number(l.cantidad) * Number(l.precio) * (1 - Number(l.descuento || 0) / 100);
  }

  // Pesos y dólares nunca se mezclan: cada línea suma solo al acumulador
  // de su propia moneda, igual que hace el servidor.
  const lineasUYU = lineas.filter((l) => l.moneda === "UYU");
  const lineasUSD = lineas.filter((l) => l.moneda === "USD");
  const subtotalUYU = lineasUYU.reduce((acc, l) => acc + totalLinea(l), 0);
  const subtotalUSD = lineasUSD.reduce((acc, l) => acc + totalLinea(l), 0);
  const ivaUYU = lineasUYU.reduce((acc, l) => acc + (l.tipoIva === "TOTAL" ? totalLinea(l) * 0.22 : 0), 0);
  const ivaUSD = lineasUSD.reduce((acc, l) => acc + (l.tipoIva === "TOTAL" ? totalLinea(l) * 0.22 : 0), 0);
  const totalUYU = subtotalUYU + ivaUYU;
  const totalUSD = subtotalUSD + ivaUSD;
  const hayLineaConIva = lineas.some((l) => l.tipoIva === "TOTAL");

  if (clientes.length === 0 || !hayProductos) {
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
            <FormField
              label="Cliente"
              required
              action={
                <button type="button" onClick={() => setNuevoClienteAbierto(true)} className="text-xs font-medium text-primary hover:underline">
                  + Nuevo cliente
                </button>
              }
            >
              <Select
                value={clienteId}
                onChange={async (e) => {
                  const nuevoId = e.target.value;
                  setClienteId(nuevoId);
                  // Cambiar de cliente puede cambiar la lista de precio
                  // aplicable — si ya hay un producto elegido en la línea
                  // en curso, se vuelve a pedir su precio para el cliente nuevo.
                  if (!productoActual) return;
                  const nuevaLista = clientes.find((c) => c.id === nuevoId)?.listaPrecioId;
                  const params = new URLSearchParams({ id: productoActual.id });
                  if (nuevaLista) params.set("listaPrecioId", nuevaLista);
                  const res = await fetch(`/api/productos/buscar?${params}`);
                  const actualizado: ProductoOpcion | undefined = res.ok ? (await res.json()).productos[0] : undefined;
                  if (actualizado) {
                    setProductoActual(actualizado);
                    setLineaActual((l) => ({ ...l, precio: actualizado.precioVenta }));
                  }
                }}
              >
                {clientesOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
              <ProductoAutocomplete seleccionado={productoActual} onChange={elegirProducto} listaPrecioId={listaPrecioId} />
            </FormField>
            {(() => {
              const p = productoActual;
              const cantidad = Number(lineaActual.cantidad || 0);
              if (!p || cantidad <= p.stockActual) return null;
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
              <FormField label="Cantidad">
                <Input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} />
              </FormField>
              <FormField label={`${productoActual?.precioDeLista ? "Precio unitario (lista del cliente)" : "Precio unitario"} (${lineaActual.moneda === "USD" ? "US$" : "$"})`}>
                <Input type="number" step="0.01" min="0" value={lineaActual.precio} onChange={(e) => setLineaActual({ ...lineaActual, precio: e.target.value })} placeholder={lineaActual.moneda === "USD" ? "US$" : "$"} />
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
                      <Table.HeadCell>IVA</Table.HeadCell>
                      <Table.HeadCell>Subtotal</Table.HeadCell>
                      <Table.HeadCell />
                    </Table.Row>
                  </Table.Head>
                  <tbody>
                    {lineas.map((l, i) => (
                      <Table.Row key={i}>
                        <Table.Cell>{l.nombre}</Table.Cell>
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
                        <Table.Cell>
                          <Select
                            value={l.tipoIva}
                            onChange={(e) => actualizarLinea(i, { tipoIva: e.target.value as "EXENTO" | "TOTAL" })}
                            className="w-24"
                          >
                            <option value="EXENTO">Exento</option>
                            <option value="TOTAL">22%</option>
                          </Select>
                        </Table.Cell>
                        <Table.Cell className="font-mono tabular-nums">
                          {l.moneda === "USD" ? "US$" : "$"} {formatoMoneda(totalLinea(l))}
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
                  Subtotal{hayLineaConIva ? " sin IVA" : ""}:{" "}
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    $ {formatoMoneda(subtotalUYU)}{subtotalUSD !== 0 && <> · US$ {formatoMoneda(subtotalUSD)}</>}
                  </span>
                  {hayLineaConIva && (
                    <>
                      {" "}· IVA:{" "}
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        $ {formatoMoneda(ivaUYU)}{ivaUSD !== 0 && <> · US$ {formatoMoneda(ivaUSD)}</>}
                      </span>
                    </>
                  )}
                  {" · "}
                  <span className="font-semibold text-foreground">
                    Total: <span className="font-mono tabular-nums">$ {formatoMoneda(totalUYU)}{totalUSD !== 0 && <> · US$ {formatoMoneda(totalUSD)}</>}</span>
                  </span>
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

      <PromptDialog
        open={nuevoClienteAbierto}
        title="Nuevo cliente"
        label="Nombre"
        placeholder="Ej: Juan Pérez"
        confirmLabel="Crear y elegir"
        loading={creandoCliente}
        error={errorCliente}
        onConfirm={crearCliente}
        onCancel={() => { setNuevoClienteAbierto(false); setErrorCliente(null); }}
      />
    </div>
  );
}
