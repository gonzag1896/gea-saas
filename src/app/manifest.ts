import type { MetadataRoute } from "next";

// Convención de Next.js App Router: esto se sirve automáticamente en
// /manifest.webmanifest y es lo que Chrome lee para ofrecer "Instalar app".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GEA — Gestión Empresarial Ágil",
    short_name: "GEA",
    description: "Sistema de gestión para ferreterías: catálogo, ventas, compras, cuenta corriente y caja.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0067b8",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
