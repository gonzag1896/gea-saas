-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "listaPrecioId" TEXT;

-- CreateTable
CREATE TABLE "ListaPrecio" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProducto" (
    "id" TEXT NOT NULL,
    "ferreteriaId" TEXT NOT NULL,
    "listaPrecioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListaPrecio_id_ferreteriaId_key" ON "ListaPrecio"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "ListaPrecio_ferreteriaId_nombre_key" ON "ListaPrecio"("ferreteriaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioProducto_id_ferreteriaId_key" ON "PrecioProducto"("id", "ferreteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioProducto_ferreteriaId_listaPrecioId_productoId_key" ON "PrecioProducto"("ferreteriaId", "listaPrecioId", "productoId");

-- CreateIndex
CREATE INDEX "Cliente_ferreteriaId_listaPrecioId_idx" ON "Cliente"("ferreteriaId", "listaPrecioId");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_listaPrecioId_ferreteriaId_fkey" FOREIGN KEY ("listaPrecioId", "ferreteriaId") REFERENCES "ListaPrecio"("id", "ferreteriaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaPrecio" ADD CONSTRAINT "ListaPrecio_ferreteriaId_fkey" FOREIGN KEY ("ferreteriaId") REFERENCES "Ferreteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_listaPrecioId_ferreteriaId_fkey" FOREIGN KEY ("listaPrecioId", "ferreteriaId") REFERENCES "ListaPrecio"("id", "ferreteriaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_productoId_ferreteriaId_fkey" FOREIGN KEY ("productoId", "ferreteriaId") REFERENCES "Producto"("id", "ferreteriaId") ON DELETE CASCADE ON UPDATE CASCADE;

