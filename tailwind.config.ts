import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Una sola familia para todo. `font-mono` (usado en cifras y códigos)
        // apunta a la MISMA fuente: se ve igual en todos los equipos, y la
        // alineación de importes la da el numeral tabular (globals.css).
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        mono: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--color-primary)", foreground: "var(--color-primary-foreground)" },
        secondary: { DEFAULT: "var(--color-secondary)", foreground: "var(--color-secondary-foreground)" },
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        muted: { DEFAULT: "var(--color-muted)", foreground: "var(--color-muted-foreground)" },
        danger: { DEFAULT: "var(--color-danger)", foreground: "var(--color-danger-foreground)" },
        warning: { DEFAULT: "var(--color-warning)", foreground: "var(--color-warning-foreground)" },
        success: { DEFAULT: "var(--color-success)", foreground: "var(--color-success-foreground)" },
        sidebar: {
          DEFAULT: "var(--color-sidebar)",
          foreground: "var(--color-sidebar-foreground)",
          "foreground-active": "var(--color-sidebar-foreground-active)",
          border: "var(--color-sidebar-border)",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        popover: "0 4px 16px -4px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
