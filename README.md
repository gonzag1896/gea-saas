# GEA — Gestión Empresarial Ágil (SaaS multi-ferretería)

Reconstrucción de GEA (originalmente un ERP GeneXus para una única
ferretería) como plataforma multi-tenant capaz de operar muchas ferreterías
en simultáneo: Next.js + Prisma + PostgreSQL + Auth.js, en Netlify.

El contexto completo (relevamiento del sistema GeneXus original, modelo
funcional, decisiones de arquitectura, plan de desarrollo por fases y la
revisión técnica que cerró las fundaciones) vive en los documentos
aprobados antes de este código — no se repite acá.

## Estado del proyecto

En desarrollo por fases, de fundaciones hacia funcionalidades de negocio.
**No avanzar a una fase sin haber cerrado la anterior** — ver el checklist
de la revisión técnica.

- [x] Fase 0 — Preparación
- [x] Fase 1 — Arquitectura y proyecto base
- [x] Fase 2 — Modelo de datos
- [ ] Fase 3 — Autenticación y usuarios (bloqueada hasta validar 0-2)
- [ ] Fase 4 en adelante — ver plan de desarrollo

## Stack

- **Next.js 14** (App Router, TypeScript, `src/`, alias `@/*`)
- **Prisma** → PostgreSQL (Supabase en producción, Docker en desarrollo)
- **Auth.js v5** (Credentials + `@auth/prisma-adapter`) — configurado en
  Fase 1, con lógica real recién en Fase 3
- **Resend** — email transaccional (recuperación de contraseña, Fase 3)
- **Tailwind CSS**, **Recharts**, **lucide-react** — UI y gráficos
- **Vitest** — tests

## Levantar el proyecto en local

```bash
npm install
npm run db:local        # Postgres en Docker, puerto 5435
npx prisma migrate dev  # aplica el schema (ya versionado en prisma/migrations)
npm run db:seed         # 2 ferreterías demo, para probar aislamiento entre tenants
npm run dev
```

Credenciales del seed (`scripts/seed.js`): `dueno-a@demo.gea` /
`dueno-b@demo.gea`, contraseña `Demo1234!` — el login todavía no funciona
(Fase 3), pero los usuarios y el hash ya están en base.

Variables de entorno: copiar `env.example` a `.env` y completar `AUTH_SECRET`
(`npx auth secret`) y `RESEND_API_KEY` cuando corresponda (Fase 3).

## Convención de capas

Sin capa de repositorios ni Prisma Client Extension: cada handler valida la
sesión con `auth()`, saca `ferreteriaId` de ahí (nunca del cliente) y lo
pasa explícito a cada llamada a Prisma.

```
src/
  app/
    api/<recurso>/route.ts         # Route Handlers (GET/POST) por recurso
    api/<recurso>/[id]/route.ts    # operaciones sobre un registro puntual
    (dashboard)/...                # pantallas autenticadas (Fase 6+)
    login/...                      # pantallas públicas de auth (Fase 3)
  lib/
    db.ts                          # cliente Prisma (singleton)
    auth.ts / auth.config.ts       # Auth.js — edge-safe vs. Node completo
    <dominio>.ts                   # lógica de negocio por módulo (ventas.ts,
                                    # compras.ts, stock.ts, cuentacorriente.ts...)
  types/                           # aumento de tipos (next-auth.d.ts, etc.)
```

**Por qué esto y no repositorios + Prisma Extension**: la primera versión
del plan proponía esa capa extra; se simplificó a algo más directo — sesión
→ `ferreteriaId` explícito → Prisma directo desde el route handler. La
razón por la que sigue siendo seguro sin esa capa es estructural, no
disciplinar: **todo modelo que cuelga de una Ferretería tiene una FK
compuesta `(id, ferreteriaId)` hacia su padre** (ver el encabezado de
`prisma/schema.prisma`), así que aunque un handler nuevo se olvidara el
filtro, Postgres rechaza cualquier fila que quede cruzada entre dos
ferreterías.

## Base de datos

`prisma/schema.prisma` es la fuente de verdad. Algunas restricciones no
tienen atributo nativo en el DSL de Prisma (CHECK constraints, índices
únicos parciales) y están agregadas a mano al final de
`prisma/migrations/20260913204914_init/migration.sql` — ver el comentario
ahí si se regenera el modelo.
