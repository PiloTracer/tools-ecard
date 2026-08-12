-- Pass 3: user-defined field mapping.
-- 1) batches.field_mapping persists the explicit mapping applied at parse time (consumed on retry).
-- 2) field_mapping_presets stores per-user saved mappings with a header signature for auto-suggest.
-- Idempotent: dev databases created via init SQL / db push may already have the objects.
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "field_mapping" JSONB;

CREATE TABLE IF NOT EXISTS "field_mapping_presets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_mapping_presets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "field_mapping_presets_user_id_idx" ON "field_mapping_presets"("user_id");
CREATE INDEX IF NOT EXISTS "field_mapping_presets_user_id_signature_idx" ON "field_mapping_presets"("user_id", "signature");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'field_mapping_presets_user_id_fkey'
    ) THEN
        ALTER TABLE "field_mapping_presets"
            ADD CONSTRAINT "field_mapping_presets_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
