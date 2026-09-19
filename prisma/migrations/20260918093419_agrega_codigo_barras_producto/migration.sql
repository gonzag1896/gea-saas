-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "codigoBarras" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_ferreteriaId_codigoBarras_key" ON "Producto"("ferreteriaId", "codigoBarras");

