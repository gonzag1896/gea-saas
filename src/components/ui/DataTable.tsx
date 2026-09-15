"use client";

import { useMemo, useState, type ReactNode } from "react";
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

interface DataTableProps<T> {
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

  const filtered = useMemo(() => {
    if (!searchValue || !query.trim()) return data;
    const q = query.trim().toLowerCase();
    return data.filter((row) => searchValue(row).toLowerCase().includes(q));
  }, [data, query, searchValue]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
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

  const totalPaginas = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginaActual = Math.min(page, totalPaginas);
  const paginado = sorted.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);

  function alternarOrden(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {(searchValue || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchValue ? (
            <SearchInput
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              className="max-w-xs"
            />
          ) : <div />}
          {actions}
        </div>
      )}

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
                    {sortKey === col.key ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
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

      {loading && <PageLoading />}
      {!loading && sorted.length === 0 && <EmptyState message={query ? "No se encontraron resultados." : emptyMessage} />}

      {!loading && totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {paginaActual} de {totalPaginas} · {sorted.length} resultados</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={paginaActual === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
