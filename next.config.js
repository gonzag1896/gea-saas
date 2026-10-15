/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // pdfkit carga sus fuentes con createRequire(import.meta.url). Si webpack
    // lo empaqueta, esa ruta queda fija a la de la compilación (/vercel/path0)
    // y en ejecución (/var/task) no existe: "Cannot find module
    // '#standard-fonts/Helvetica'" y los PDF dan 500 en Vercel (en local anda
    // porque la ruta de compilación sigue existiendo). Se carga desde
    // node_modules y se fuerza a que sus archivos viajen con las funciones.
    serverComponentsExternalPackages: ["pdfkit"],
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/pdfkit/js/**/*", "./node_modules/pdfkit/package.json"],
    },
  },

  // Headers de seguridad básicos. Sin CSP todavía: definir una que no
  // rompa el dashboard requiere probarla a mano pantalla por pantalla, no
  // algo para meter de entrada.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
