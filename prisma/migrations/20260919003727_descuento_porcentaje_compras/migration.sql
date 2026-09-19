-- AlterTable
ALTER TABLE "CompraDetalle" ADD COLUMN     "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VentaDetalle" ALTER COLUMN "descuento" SET DATA TYPE DECIMAL(5,2);

