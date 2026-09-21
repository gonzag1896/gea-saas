import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { listarUsuariosFerreteria } from "@/lib/usuarios";
import { Alert } from "@/components/ui/Alert";
import { UsuariosClient } from "./UsuariosClient";

export default async function UsuariosPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  if (!tienePermiso(contexto.rol, "usuarios", "ver")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para ver esta sección.</Alert>
      </div>
    );
  }

  const usuarios = await listarUsuariosFerreteria(contexto.ferreteriaId);

  return (
    <UsuariosClient
      usuariosIniciales={usuarios}
      usuarioActualId={contexto.usuarioId}
      puedeCrear={tienePermiso(contexto.rol, "usuarios", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "usuarios", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "usuarios", "eliminar")}
    />
  );
}
