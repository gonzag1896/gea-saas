import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();

  // No alcanza con que exista un JWT: si la contraseña cambió o le
  // revocaron la membresía después de emitido, sigue "presente" pero ya no
  // es válido. Sin este chequeo acá, (app)/layout.tsx manda a /login por
  // sesión inválida y esta página lo devolvía a /dashboard solo por ver un
  // JWT — un loop infinito entre las dos rutas.
  if (session?.user) {
    const valida = await sesionSigueValida({
      id: session.user.id,
      emitidoEn: session.user.emitidoEn,
      ferreteriaId: session.user.ferreteriaId,
      rol: session.user.rol,
      isSuperAdmin: session.user.isSuperAdmin,
    });
    if (valida) redirect("/dashboard");
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Ingresar a GEA</h1>
      <LoginForm />
    </main>
  );
}
