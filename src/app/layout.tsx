import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/Toast";
import { Analytics } from "@vercel/analytics/next";

// ÚNICA tipografía de toda la plataforma. next/font la descarga en la
// compilación y la sirve desde nuestro propio dominio, así se ve idéntica en
// todos los equipos y navegadores (sin depender de lo que tenga instalado cada
// uno ni de un servicio externo). Es una fuente variable: todos los pesos
// (400-700) salen del mismo archivo. Las cifras usan numerales tabulares (ver
// globals.css), por eso ya no hace falta una fuente monoespaciada.
const fuente = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GEA",
  description: "Gestión Empresarial Ágil — plataforma multi-ferretería",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0067b8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${fuente.variable} antialiased`}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
