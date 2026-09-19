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
    if (valida) {
      // Un Super Admin puro (sin ferretería en modo soporte) no tiene nada
      // que mostrar en /dashboard — esa página redirige a /login si no hay
      // ferretería activa, lo que generaba un loop infinito login↔dashboard
      // para este usuario. Va directo a elegir una ferretería en soporte.
      if (session.user.isSuperAdmin && !session.user.ferreteriaId) redirect("/seleccionar-ferreteria");
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col items-center justify-center gap-10 bg-sidebar p-12 lg:flex">
        {/* Logo transparente con tinta oscura — sobre el fondo azul oscuro
            del panel queda invisible sin una franja clara propia detrás,
            igual que en el sidebar (ver sidebar.tsx). */}
        <div className="w-fit rounded-lg bg-white px-8 py-6">
          <img src="/logo-gea.png" alt="GEA" className="h-auto w-80 object-contain" />
        </div>
        <div className="flex max-w-sm flex-col gap-2 text-center">
          <p className="text-2xl font-semibold text-white">Gestión simple para tu ferretería</p>
          <p className="text-sm text-sidebar-foreground">
            Ventas, compras, stock y cuenta corriente en un solo lugar, pensado para el día a día del mostrador.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-8 bg-background p-6 lg:w-1/2">
        <img src="/logo-gea.png" alt="GEA" className="h-auto w-40 object-contain lg:hidden" />
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-foreground">Ingresar a GEA</h1>
          <p className="mb-6 text-sm text-muted-foreground">Ingresá con tu email y contraseña.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
