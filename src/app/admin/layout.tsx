import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";

// Shell del panel de Super Admin: header propio (no el Sidebar/Header de
// (app), que asume una ferretería activa) + guardia de sesión única para
// todo lo que cuelga de acá — las pantallas hijas no repiten el chequeo.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-sidebar-border bg-sidebar">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/ferreterias" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">
              GEA <span className="font-normal text-sidebar-foreground">· Panel de administración</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-sidebar-foreground">{session.user.email}</span>
            <Link
              href="/seleccionar-ferreteria"
              className="rounded-md border border-sidebar-border px-3 py-1.5 text-sidebar-foreground transition-colors hover:border-white/30 hover:text-white"
            >
              Modo soporte
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
