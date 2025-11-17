#!/bin/bash
# Database sync script for development
# Runs Prisma db push to sync schema without migrations

echo "🔄 Syncing database schema with Prisma..."

# Generate Prisma client
npx prisma generate

# Push schema to database (development mode)
npx prisma db push --skip-generate

echo "✅ Database schema synced successfully!"