import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/Toast";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GEA",
  description: "Gestión Empresarial Ágil — plataforma multi-ferretería",
  icons: { icon: "/logo-gea.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${sourceSans.variable} antialiased`}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
