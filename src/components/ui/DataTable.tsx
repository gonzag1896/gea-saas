"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Table } from "./Table";
import { SearchInput } from "./SearchInput";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { PageLoading } from "./PageLoading";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headClassName?: string;
}

// Modo servidor: la búsqueda, el orden y la paginación viven en la URL
// (?q=&orden=&dir=&page=) y los resuelve el Server Component con Prisma —
// el navegador solo recibe la página actual. La key de cada columna
// ordenable es el valor de ?orden=.
export interface DataTableServidor {
  q: string;
  pagina: number;
  totalPaginas: number;
  total: number;
  orden: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  servidor?: DataTableServidor;
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  pageSize?: number;
  emptyMessage?: string;
  loading?: boolean;
  actions?: ReactNode;
}

// Tabla reutilizable con búsqueda, orden por columna y paginación en
// cliente — todos los listados de GEA ya traen sus datos completos del
// Server Component, así que no hace falta ida y vuelta al servidor para
// nada de esto. Reemplaza el <Table> crudo repetido módulo por módulo.
export function DataTable<T>({
  servidor,
  data,
  columns,
  rowKey,
  searchPlaceholder,
  searchValue,
  pageSize = 10,
  emptyMessage = "No hay datos para mostrar.",
  loading = false,
  actions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, iniciarTransicion] = useTransition();
  const [textoServidor, setTextoServidor] = useState(servidor?.q ?? "");

  function irA(cambios: Partial<{ q: string; pagina: number; orden: string; dir: string }>) {
    if (!servidor) return;
    const q = cambios.q ?? servidor.q;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("orden", cambios.orden ?? servidor.orden);
    params.set("dir", cambios.dir ?? servidor.dir);
    params.set("page", String(cambios.pagina ?? servidor.pagina));
    iniciarTransicion(() => router.replace(`${pathname}?${params}`));
  }

  // Búsqueda con espera de 300 ms para no consultar en cada tecla.
  useEffect(() => {
    if (!servidor || textoServidor === servidor.q) return;
    const espera = setTimeout(() => irA({ q: textoServidor, pagina: 1 }), 300);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoServidor]);

  const filtered = useMemo(() => {
    if (servidor || !searchValue || !query.trim()) return data;
    const q = query.trim().toLowerCase();
    return data.filter((row) => searchValue(row).toLowerCase().includes(q));
  }, [data, query, searchValue]);

  const sorted = useMemo(() => {
    if (servidor || !sortKey) return filtered;
    const columna = columns.find((c) => c.key === sortKey);
    if (!columna?.sortValue) return filtered;
    const copia = [...filtered];
    copia.sort((a, b) => {
      const va = columna.sortValue!(a);
      const vb = columna.sortValue!(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copia;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPaginas = servidor ? servidor.totalPaginas : Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginaActual = servidor ? servidor.pagina : Math.min(page, totalPaginas);
  const totalResultados = servidor ? servidor.total : sorted.length;
  const paginado = servidor ? data : sorted.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);
  const hayBusqueda = servidor ? servidor.q !== "" : query !== "";

  function alternarOrden(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (servidor) {
      irA({ orden: col.key, dir: servidor.orden === col.key && servidor.dir === "asc" ? "desc" : "asc", pagina: 1 });
      return;
    }
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {(searchValue || servidor || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchValue || servidor ? (
            <SearchInput
              value={servidor ? textoServidor : query}
              onChange={(e) => { if (servidor) setTextoServidor(e.target.value); else { setQuery(e.target.value); setPage(1); } }}
              placeholder={searchPlaceholder}
              className="max-w-xs"
            />
          ) : <div />}
          {actions}
        </div>
      )}

      <div className={pendiente ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <Table>
        <Table.Head>
          <Table.Row>
            {columns.map((col) => (
              <Table.HeadCell key={col.key} className={col.headClassName}>
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => alternarOrden(col)}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    {col.header}
                    {(servidor ? servidor.orden : sortKey) === col.key ? (
                      (servidor ? servidor.dir : sortDir) === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </Table.HeadCell>
            ))}
          </Table.Row>
        </Table.Head>
        <tbody>
          {paginado.map((row) => (
            <Table.Row key={rowKey(row)}>
              {columns.map((col) => (
                <Table.Cell key={col.key} className={col.className}>{col.render(row)}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </tbody>
      </Table>
      </div>

      {loading && <PageLoading />}
      {!loading && totalResultados === 0 && <EmptyState message={hayBusqueda ? "No se encontraron resultados." : emptyMessage} />}

      {!loading && totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {paginaActual} de {totalPaginas} · {totalResultados} resultados</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => (servidor ? irA({ pagina: paginaActual - 1 }) : setPage((p) => Math.max(1, p - 1)))} disabled={paginaActual === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => (servidor ? irA({ pagina: paginaActual + 1 }) : setPage((p) => Math.min(totalPaginas, p + 1)))} disabled={paginaActual === totalPaginas}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
