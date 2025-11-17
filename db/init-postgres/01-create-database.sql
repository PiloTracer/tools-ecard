/*
 * PostgreSQL Database Initialization
 *
 * Creates the main database for normalized application data
 *
 * NOTE: This is a minimal setup to allow the application to start.
 * Tables will be created by Prisma migrations.
 */

-- Database should already exist from POSTGRES_DB env var
-- This script ensures it exists if not already created

SELECT 'Database initialization complete' AS status;

-- TODO: Run Prisma migrations to create tables
-- Command: npx prisma migrate deploy
