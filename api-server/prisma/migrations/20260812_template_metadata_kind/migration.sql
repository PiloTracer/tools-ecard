-- Add kind to template_metadata ('template' | 'design'; Pass 4: user templates vs card designs).
-- Existing rows default to 'design' — correct semantics (they were working documents).
-- Idempotent: dev databases created via init SQL / db push may already have the column.
ALTER TABLE "template_metadata" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'design';
