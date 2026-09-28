-- CreateIndex
CREATE INDEX "MovimientoStock_ferreteriaId_createdAt_idx" ON "MovimientoStock"("ferreteriaId", "createdAt");

-- CreateIndex
CREATE INDEX "Producto_ferreteriaId_descripcion_idx" ON "Producto"("ferreteriaId", "descripcion");
