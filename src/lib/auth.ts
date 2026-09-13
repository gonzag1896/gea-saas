import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { dentroDelLimite, obtenerIp } from "@/lib/rate-limit";
import { auditar } from "@/lib/auditoria";

// Freno de fuerza bruta por cuenta. Corto a propósito: alcanza para que
// probar contraseñas al voleo deje de ser viable, y evita que alguien deje
// afuera al dueño de una ferretería a propósito fallando su login.
const INTENTOS_ANTES_DE_BLOQUEAR = 5;
const BLOQUEO_MINUTOS = 15;

// Freno aparte por IP: el de arriba es por cuenta, así que probar muchos
// emails distintos desde la misma IP no activaba ningún bloqueo.
const INTENTOS_POR_IP = 20;
const VENTANA_IP_MS = 5 * 60_000;

// Configuración completa: corre en Node, así que puede usar Prisma y bcrypt.
// Lo edge-safe (el callback `session`) sale de authConfig.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),

  logger: {
    error(error) {
      // Una contraseña equivocada es uso normal, no un incidente — Auth.js
      // la reporta como CredentialsSignin con un stack trace largo. Con
      // varias ferreterías eso llena los logs y tapa los errores que sí
      // hay que mirar. El resto se sigue registrando entero.
      if (error.name === "CredentialsSignin") return;
      console.error("[auth]", error);
    },
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;

        // Se chequea antes de tocar la base: si alguien está probando
        // muchos emails distintos desde la misma IP, ni siquiera llega a
        // comparar contraseñas.
        const ip = obtenerIp(request.headers);
        if (!(await dentroDelLimite(`login:ip:${ip}`, INTENTOS_POR_IP, VENTANA_IP_MS))) {
          return null;
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });

        // Mismo camino (return null → "credenciales inválidas" genérico)
        // para email inexistente, sin password, o bloqueado: nada acá debe
        // revelar cuál de los tres pasó.
        if (!usuario || !usuario.passwordHash) return null;
        if (usuario.estado === "INACTIVO" || usuario.estado === "BLOQUEADO") return null;
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) return null;

        const valido = await bcrypt.compare(credentials.password as string, usuario.passwordHash);

        if (!valido) {
          const intentos = usuario.intentosFallidos + 1;
          await prisma.usuario.update({
            where: { id: usuario.id },
            data:
              intentos >= INTENTOS_ANTES_DE_BLOQUEAR
                ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) }
                : { intentosFallidos: intentos },
          });
          await auditar({ accion: "LOGIN_FALLIDO", detalle: { email }, ip });
          return null;
        }

        if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          });
        }

        await auditar({ accion: "LOGIN_OK", usuarioId: usuario.id, ip });

        return { id: usuario.id, email: usuario.email, name: usuario.name };
      },
    }),
  ],

  callbacks: {
    // El callback `session` se hereda de authConfig — es el mismo que
    // necesita el middleware (Fase 4) y no toca la base.
    ...authConfig.callbacks,

    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.usuario.findUnique({
          where: { id: user.id },
          include: {
            ferreterias: {
              where: { estado: "ACTIVO" },
              include: { ferreteria: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });

        token.id = user.id;
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false;

        // Primera membresía activa como ferretería inicial. Alguien con más
        // de una recién puede elegir entre ellas cuando exista el selector
        // (Fase 4) — acá solo se resuelve un valor de arranque razonable.
        const membresia = dbUser?.ferreterias[0];
        token.ferreteriaId = membresia?.ferreteriaId ?? null;
        token.ferreteriaNombre = membresia?.ferreteria.nombre ?? null;
        token.rol = membresia?.rol ?? null;
        token.soporte = false;

        // Marca de emisión: se compara contra passwordCambiadoAt para
        // cortar sesiones viejas cuando alguien cambia su contraseña.
        token.emitidoEn = Date.now();
      }
      return token;
    },
  },
});
