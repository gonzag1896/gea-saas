import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

export default defineConfig({
  resolve: {
    // Mismo alias que usa la app, para poder importar con "@/lib/...".
    alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Fase 1/2 todavía no tienen lógica propia que testear (eso empieza en
    // Fase 3). Sin esto, "vitest run" sin archivos de test falla el CI.
    passWithNoTests: true,
  },
});
