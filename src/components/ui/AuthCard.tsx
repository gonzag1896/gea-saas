import type { ReactNode } from "react";

// Envoltorio visual compartido por las pantallas de autenticación
// secundarias (recuperar/restablecer contraseña, elegir ferretería) — el
// mismo lenguaje de login/page.tsx (logo + card centrada) sin el panel de
// marca a dos columnas, que es específico de la pantalla de ingreso.
export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <img src="/logo-gea.png" alt="GEA" className="mx-auto mb-6 h-auto w-40 object-contain" />
        <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="mb-6 text-sm text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
