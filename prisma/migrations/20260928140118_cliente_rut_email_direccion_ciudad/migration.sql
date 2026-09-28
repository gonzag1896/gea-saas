-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "rut" TEXT;

-- CreateIndex (parcial, mismo criterio que Proveedor_ferreteriaId_rut_key)
CREATE UNIQUE INDEX "Cliente_ferreteriaId_rut_key" ON "Cliente"("ferreteriaId", "rut") WHERE "rut" IS NOT NULL;
