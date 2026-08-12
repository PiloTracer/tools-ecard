-- Add is_public to template_metadata (declared in schema.prisma as isPublic @map("is_public")).
-- Idempotent: dev databases created via init SQL / db push may already have the column.
ALTER TABLE "template_metadata" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
