-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('INVITADO', 'ACTIVO', 'BLOQUEADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoFerreteria" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "RolFerreteria" AS ENUM ('DUENO', 'CAJERO', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('UYU', 'USD');

-- CreateEnum
CREATE TYPE "EstadoOperacion" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoIva" AS ENUM ('EXENTO', 'TOTAL');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('CONTADO', 'CREDITO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO');

-- CreateEnum
CREATE TYPE "OrigenMovimientoStock" AS ENUM ('COMPRA', 'VENTA', 'AJUSTE', 'DEVOLUCION_COMPRA', 'DEVOLUCION_VENTA');

-- CreateEnum
CREATE TYPE "OrigenCuentaCliente" AS ENUM ('VENTA_CREDITO', 'COBRO', 'DEVOLUCION_VENTA', 'ANULACION_VENTA_CREDITO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'INVITADO',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "passwordCambiadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Ferreteria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoFerreteria" NOT NULL DEFAULT 'ACTIVO',
    "slug" TEXT,
    "rut" TEXT,
    "razonSocial" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "logoUrl" TEXT,
    "colorPrimario" TEXT,
    "moduleFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ferreteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FerreteriaUsuario" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "RolFerreteria" NOT NULL,
    "estado" "EstadoMembresia" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FerreteriaUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategoria" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "subCategoriaId" TEXT NOT NULL,
    "marcaId" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'UYU',
    "precioCosto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "fechaUltCompra" DATE,
    "fechaUltActualizacionPrecio" DATE,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "numeroFactura" TEXT,
    "facturaPdfUrl" TEXT,
    "estado" "EstadoOperacion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "registradoPorUsuarioId" TEXT,
    "anuladoPorUsuarioId" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraDetalle" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(12,2) NOT NULL,
    "tipoIva" "TipoIva" NOT NULL DEFAULT 'EXENTO',
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CompraDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionCompra" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "compraDetalleId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevolucionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoOperacion" NOT NULL DEFAULT 'PENDIENTE',
    "tipoIva" "TipoIva" NOT NULL DEFAULT 'EXENTO',
    "medioPago" "MedioPago" NOT NULL DEFAULT 'CONTADO',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "entrega" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "registradoPorUsuarioId" TEXT,
    "anuladoPorUsuarioId" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDetalle" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cantidad" INTEGER NOT NULL,
    "cantidadDevuelta" INTEGER NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "totalVigente" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "VentaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionVenta" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "ventaDetalleId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevolucionVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "origenTipo" "OrigenMovimientoStock" NOT NULL,
    "origenId" TEXT,
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaCliente" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "debe" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "origenTipo" "OrigenCuentaCliente" NOT NULL,
    "origenId" TEXT,
    "referencia" TEXT,
    "registradoPorUsuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "ferreteriaId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "ventana" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Ferreteria_slug_key" ON "Ferreteria"("slug");

-- CreateIndex
CREATE INDEX "Ferreteria_estado_idx" ON "Ferreteria"("estado");

-- CreateIndex
CREATE INDEX "FerreteriaUsuario_usuarioId_idx" ON "FerreteriaUsuario"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "FerreteriaUsuario_ferreteriaId_usuarioId_key" ON "FerreteriaUsuario"("ferreteriaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_id_ferreteriaId_key" ON "Categoria"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_ferreteriaId_nombre_key" ON "Categoria"("ferreteriaId", "nombre");

-- CreateIndex
CREATE INDEX "SubCategoria_ferreteriaId_idx" ON "SubCategoria"("ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategoria_id_ferreteriaId_key" ON "SubCategoria"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategoria_categoriaId_nombre_key" ON "SubCategoria"("categoriaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_id_ferreteriaId_key" ON "Marca"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_ferreteriaId_nombre_key" ON "Marca"("ferreteriaId", "nombre");

-- CreateIndex
CREATE INDEX "Producto_ferreteriaId_subCategoriaId_idx" ON "Producto"("ferreteriaId", "subCategoriaId");

-- CreateIndex
CREATE INDEX "Producto_ferreteriaId_marcaId_idx" ON "Producto"("ferreteriaId", "marcaId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_id_ferreteriaId_key" ON "Producto"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_ferreteriaId_codigo_key" ON "Producto"("ferreteriaId", "codigo");

-- CreateIndex
CREATE INDEX "Cliente_ferreteriaId_idx" ON "Cliente"("ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_id_ferreteriaId_key" ON "Cliente"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "Proveedor_ferreteriaId_idx" ON "Proveedor"("ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_id_ferreteriaId_key" ON "Proveedor"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "Compra_ferreteriaId_fecha_idx" ON "Compra"("ferreteriaId", "fecha");

-- CreateIndex
CREATE INDEX "Compra_ferreteriaId_estado_idx" ON "Compra"("ferreteriaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_id_ferreteriaId_key" ON "Compra"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "CompraDetalle_compraId_idx" ON "CompraDetalle"("compraId");

-- CreateIndex
CREATE INDEX "CompraDetalle_ferreteriaId_productoId_idx" ON "CompraDetalle"("ferreteriaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "CompraDetalle_id_ferreteriaId_key" ON "CompraDetalle"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "DevolucionCompra_compraDetalleId_idx" ON "DevolucionCompra"("compraDetalleId");

-- CreateIndex
CREATE INDEX "Venta_ferreteriaId_fecha_idx" ON "Venta"("ferreteriaId", "fecha");

-- CreateIndex
CREATE INDEX "Venta_ferreteriaId_estado_idx" ON "Venta"("ferreteriaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_id_ferreteriaId_key" ON "Venta"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "VentaDetalle_ventaId_idx" ON "VentaDetalle"("ventaId");

-- CreateIndex
CREATE INDEX "VentaDetalle_ferreteriaId_productoId_idx" ON "VentaDetalle"("ferreteriaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "VentaDetalle_id_ferreteriaId_key" ON "VentaDetalle"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "DevolucionVenta_ventaDetalleId_idx" ON "DevolucionVenta"("ventaDetalleId");

-- CreateIndex
CREATE INDEX "MovimientoStock_ferreteriaId_productoId_fecha_idx" ON "MovimientoStock"("ferreteriaId", "productoId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoStock_origenTipo_origenId_idx" ON "MovimientoStock"("origenTipo", "origenId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoStock_id_ferreteriaId_key" ON "MovimientoStock"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "CuentaCliente_ferreteriaId_clienteId_fecha_idx" ON "CuentaCliente"("ferreteriaId", "clienteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaCliente_id_ferreteriaId_key" ON "CuentaCliente"("id", "ferreteriaId");

-- CreateIndex
CREATE INDEX "AuditLog_ferreteriaId_createdAt_idx" ON "AuditLog"("ferreteriaId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_clave_ventana_key" ON "RateLimit"("clave", "ventana");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FerreteriaUsuario" ADD CONSTRAINT "FerreteriaUsuario_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FerreteriaUsuario" ADD CONSTRAINT "FerreteriaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategoria" ADD CONSTRAINT "SubCategoria_categoriaId_ferreteriaId_fkey" FOREIGN KEY ("categoriaId", "ferreteriaId") REFERENCES "Categoria"("id", "ferreteriaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_subCategoriaId_ferreteriaId_fkey" FOREIGN KEY ("subCategoriaId", "ferreteriaId") REFERENCES "SubCategoria"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_marcaId_ferreteriaId_fkey" FOREIGN KEY ("marcaId", "ferreteriaId") REFERENCES "Marca"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_ferreteriaId_fkey" FOREIGN KEY ("proveedorId", "ferreteriaId") REFERENCES "Proveedor"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_anuladoPorUsuarioId_fkey" FOREIGN KEY ("anuladoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraDetalle" ADD CONSTRAINT "CompraDetalle_compraId_ferreteriaId_fkey" FOREIGN KEY ("compraId", "ferreteriaId") REFERENCES "Compra"("id", "ferreteriaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraDetalle" ADD CONSTRAINT "CompraDetalle_productoId_ferreteriaId_fkey" FOREIGN KEY ("productoId", "ferreteriaId") REFERENCES "Producto"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionCompra" ADD CONSTRAINT "DevolucionCompra_compraDetalleId_ferreteriaId_fkey" FOREIGN KEY ("compraDetalleId", "ferreteriaId") REFERENCES "CompraDetalle"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionCompra" ADD CONSTRAINT "DevolucionCompra_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_ferreteriaId_fkey" FOREIGN KEY ("clienteId", "ferreteriaId") REFERENCES "Cliente"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_anuladoPorUsuarioId_fkey" FOREIGN KEY ("anuladoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_ventaId_ferreteriaId_fkey" FOREIGN KEY ("ventaId", "ferreteriaId") REFERENCES "Venta"("id", "ferreteriaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_productoId_ferreteriaId_fkey" FOREIGN KEY ("productoId", "ferreteriaId") REFERENCES "Producto"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionVenta" ADD CONSTRAINT "DevolucionVenta_ventaDetalleId_ferreteriaId_fkey" FOREIGN KEY ("ventaDetalleId", "ferreteriaId") REFERENCES "VentaDetalle"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionVenta" ADD CONSTRAINT "DevolucionVenta_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_productoId_ferreteriaId_fkey" FOREIGN KEY ("productoId", "ferreteriaId") REFERENCES "Producto"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCliente" ADD CONSTRAINT "CuentaCliente_clienteId_ferreteriaId_fkey" FOREIGN KEY ("clienteId", "ferreteriaId") REFERENCES "Cliente"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCliente" ADD CONSTRAINT "CuentaCliente_registradoPorUsuarioId_fkey" FOREIGN KEY ("registradoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Restricciones que el DSL de Prisma no expresa (Revisión técnica final,
-- sección 1): CHECK constraints e índices únicos parciales. Se agregan acá
-- a mano porque no hay atributo de schema.prisma para ninguno de los dos;
-- si el modelo vuelve a generarse con `prisma migrate dev`, estas líneas
-- hay que preservarlas o repetirlas en la migración nueva.
-- ============================================================

-- Decisión pendiente #1 (cerrada): se bloquea stock negativo.
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_stockActual_check" CHECK ("stockActual" >= 0);

-- Cantidades de línea siempre positivas.
ALTER TABLE "CompraDetalle" ADD CONSTRAINT "CompraDetalle_cantidad_check" CHECK ("cantidad" > 0);
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_cantidad_check" CHECK ("cantidad" > 0);
-- No se puede devolver más de lo vendido en la línea.
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_cantidadDevuelta_check" CHECK ("cantidadDevuelta" <= "cantidad");
ALTER TABLE "DevolucionCompra" ADD CONSTRAINT "DevolucionCompra_cantidad_check" CHECK ("cantidad" > 0);
ALTER TABLE "DevolucionVenta" ADD CONSTRAINT "DevolucionVenta_cantidad_check" CHECK ("cantidad" > 0);

-- Cuenta corriente: una fila es débito o crédito, nunca ambos ni negativa
-- (Revisión técnica final, sección 2).
ALTER TABLE "CuentaCliente" ADD CONSTRAINT "CuentaCliente_debe_haber_no_negativos_check" CHECK ("debe" >= 0 AND "haber" >= 0);
ALTER TABLE "CuentaCliente" ADD CONSTRAINT "CuentaCliente_debe_o_haber_check" CHECK ("debe" = 0 OR "haber" = 0);

-- RUT de proveedor y número de factura son únicos por ferretería solo
-- cuando están cargados (ambos son opcionales en el relevamiento original).
CREATE UNIQUE INDEX "Proveedor_ferreteriaId_rut_key" ON "Proveedor"("ferreteriaId", "rut") WHERE "rut" IS NOT NULL;
CREATE UNIQUE INDEX "Compra_ferreteriaId_proveedorId_numeroFactura_key" ON "Compra"("ferreteriaId", "proveedorId", "numeroFactura") WHERE "numeroFactura" IS NOT NULL;
