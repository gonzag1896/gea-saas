/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
