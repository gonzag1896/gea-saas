import { auth } from "@/lib/auth";

// Placeholder de Fase 3 (criterio de terminado: un usuario sembrado por
// seed puede loguearse y ver un dashboard vacío protegido). El dashboard
// real (KPIs, gráficos) es Fase 11.
export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Sesión activa: {session?.user.email}</p>
      <p>Ferretería: {session?.user.ferreteriaNombre ?? "sin asignar"}</p>
      <p>Rol: {session?.user.rol ?? "—"}</p>
    </div>
  );
}
