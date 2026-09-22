"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, RotateCcw, ArrowUpDown, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, XCircle, ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

type Rol = "DUENO" | "CAJERO" | "DEPOSITO";
type Usuario = {
  id: string; // id de la membresía (FerreteriaUsuario)
  usuarioId: string;
  nombre: string | null;
  email: string;
  rol: Rol;
  estadoMembresia: "ACTIVO" | "INACTIVO";
  estadoUsuario: "INVITADO" | "ACTIVO" | "BLOQUEADO" | "INACTIVO";
};
type SortKey = "nombre" | "rol";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

const ETIQUETA_ROL: Record<Rol, string> = { DUENO: "Dueño", CAJERO: "Cajero", DEPOSITO: "Depósito" };

function EstadoPill({ usuario }: { usuario: Usuario }) {
  if (usuario.estadoMembresia === "INACTIVO") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-500">
        <XCircle className="h-3.5 w-3.5" /> Inactivo
      </span>
    );
  }
  if (usuario.estadoUsuario === "BLOQUEADO") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-50 text-red-700">
        <ShieldAlert className="h-3.5 w-3.5" /> Bloqueado
      </span>
    );
  }
  if (usuario.estadoUsuario === "INVITADO") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-orange-50 text-orange-700">
        <Clock className="h-3.5 w-3.5" /> Invitado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-green-50 text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" /> Activo
    </span>
  );
}

export function UsuariosClient({
  usuariosIniciales,
  usuarioActualId,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  usuariosIniciales: Usuario[];
  usuarioActualId: string;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<Usuario>>>({});
  const [aDesactivar, setADesactivar] = useState<Usuario | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const u of usuariosIniciales) {
        const o = next[u.id];
        if (o && o.rol === u.rol && o.estadoMembresia === u.estadoMembresia) {
          delete next[u.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [usuariosIniciales]);

  const usuarios = usuariosIniciales.map((u) => (overrides[u.id] ? { ...u, ...overrides[u.id] } : u));

  const usuariosFiltrados = useMemo(() => {
    const filtered = usuarios.filter((u) =>
      `${u.nombre ?? ""} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    filtered.sort((a, b) => {
      const cmp = sortKey === "nombre"
        ? (a.nombre ?? a.email).toLowerCase().localeCompare((b.nombre ?? b.email).toLowerCase())
        : a.rol.localeCompare(b.rol);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [usuarios, busqueda, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);
  const usuariosPagina = usuariosFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <button
      onClick={() => toggleSort(sortBy)}
      className="flex items-center gap-2 font-semibold text-foreground hover:text-blue-600 transition-colors"
    >
      {label}
      {sortKey === sortBy && (
        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" && "rotate-180")} />
      )}
    </button>
  );

  async function cambiarRol(usuario: Usuario, nuevoRol: Rol) {
    setError(null);
    setOverrides((o) => ({ ...o, [usuario.id]: { ...o[usuario.id], rol: nuevoRol } }));
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: nuevoRol }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      setOverrides((o) => ({ ...o, [usuario.id]: { ...o[usuario.id], rol: usuario.rol } }));
      return;
    }
    router.refresh();
  }

  async function reactivar(usuario: Usuario) {
    setError(null);
    setOverrides((o) => ({ ...o, [usuario.id]: { ...o[usuario.id], estadoMembresia: "ACTIVO" } }));
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "ACTIVO" }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      setOverrides((o) => ({ ...o, [usuario.id]: { ...o[usuario.id], estadoMembresia: "INACTIVO" } }));
      return;
    }
    router.refresh();
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return;
    setDesactivando(true);
    setError(null);
    const res = await fetch(`/api/usuarios/${aDesactivar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "INACTIVO" }),
    });
    setDesactivando(false);
    if (!res.ok) {
      setError((await res.json()).error);
      setADesactivar(null);
      return;
    }
    setOverrides((o) => ({ ...o, [aDesactivar.id]: { ...o[aDesactivar.id], estadoMembresia: "INACTIVO" } }));
    setADesactivar(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Quién puede entrar a esta ferretería y qué puede hacer. Dueño ve y hace todo, Cajero opera el mostrador, Depósito maneja mercadería."
        action={puedeCrear && (
          <Button onClick={() => router.push("/usuarios/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {usuariosFiltrados.length} de {usuarios.length} usuarios
        </p>
      </div>

      {usuariosFiltrados.length === 0 ? (
        <EmptyState message={busqueda ? "No hay usuarios que coincidan con la búsqueda." : "Todavía no creaste ningún usuario."} />
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Usuario" sortBy="nombre" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Rol" sortBy="rol" />
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {usuariosPagina.map((usuario) => {
                  const esUnoMismo = usuario.usuarioId === usuarioActualId;
                  const inactivo = usuario.estadoMembresia === "INACTIVO";

                  return (
                    <tr key={usuario.id} className="transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate">
                          {usuario.nombre || usuario.email}
                          {esUnoMismo && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(vos)</span>}
                        </p>
                        {usuario.nombre && <p className="text-xs text-muted-foreground mt-0.5 truncate">{usuario.email}</p>}
                      </td>

                      <td className="px-4 py-3">
                        {puedeEditar && !esUnoMismo && !inactivo ? (
                          <Select
                            value={usuario.rol}
                            onChange={(e) => cambiarRol(usuario, e.target.value as Rol)}
                            className="h-9 text-sm"
                          >
                            {Object.entries(ETIQUETA_ROL).map(([valor, etiqueta]) => (
                              <option key={valor} value={valor}>{etiqueta}</option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-sm text-foreground">{ETIQUETA_ROL[usuario.rol]}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <EstadoPill usuario={usuario} />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {puedeEditar && !inactivo && (
                            <Tooltip label="Editar" side="left">
                              <Button
                                variant="icon"
                                className="h-8 w-8"
                                aria-label={`Editar a ${usuario.nombre || usuario.email}`}
                                onClick={() => router.push(`/usuarios/${usuario.id}/editar`)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          {!esUnoMismo && puedeEliminar && !inactivo && (
                            <Tooltip label="Desactivar" side="left">
                              <Button
                                variant="icon"
                                className="h-8 w-8 hover:text-danger"
                                aria-label={`Desactivar a ${usuario.nombre || usuario.email}`}
                                onClick={() => setADesactivar(usuario)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          {puedeEliminar && inactivo && (
                            <Tooltip label="Reactivar" side="left">
                              <Button
                                variant="icon"
                                className="h-8 w-8 hover:text-success"
                                aria-label={`Reactivar a ${usuario.nombre || usuario.email}`}
                                onClick={() => reactivar(usuario)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {paginaActual} de {totalPaginas} · {usuariosFiltrados.length} resultados</span>
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
        </>
      )}

      <ConfirmDialog
        open={aDesactivar !== null}
        title="Desactivar usuario"
        message={aDesactivar ? `¿Desactivar a "${aDesactivar.nombre || aDesactivar.email}"? Pierde el acceso a esta ferretería al instante, pero podés reactivarlo cuando quieras.` : ""}
        confirmLabel="Desactivar"
        variant="danger"
        loading={desactivando}
        onConfirm={confirmarDesactivar}
        onCancel={() => setADesactivar(null)}
      />
    </div>
  );
}
