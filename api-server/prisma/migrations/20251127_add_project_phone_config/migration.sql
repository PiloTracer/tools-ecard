-- Add phone formatting configuration to projects table
ALTER TABLE "projects" ADD COLUMN "work_phone_prefix" TEXT;
ALTER TABLE "projects" ADD COLUMN "default_country_code" TEXT;
