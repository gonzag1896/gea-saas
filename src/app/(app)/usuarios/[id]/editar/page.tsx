import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { listarUsuariosFerreteria } from "@/lib/usuarios";
import { Alert } from "@/components/ui/Alert";
import { UsuarioFormClient } from "../../UsuarioFormClient";

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "usuarios", "modificar")) redirect("/usuarios");

  const usuarios = await listarUsuariosFerreteria(contexto.ferreteriaId);
  const usuario = usuarios.find((u) => u.id === params.id);
  if (!usuario) {
    return (
      <div>
        <Alert variant="info">Usuario no encontrado.</Alert>
      </div>
    );
  }

  return <UsuarioFormClient usuario={{ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }} />;
}
