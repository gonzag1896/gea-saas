-- pg_trgm viene incluida en Postgres (contrib) y Neon la permite.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Producto_descripcion_trgm_idx" ON "Producto" USING GIN ("descripcion" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Producto_codigo_trgm_idx" ON "Producto" USING GIN ("codigo" gin_trgm_ops);
