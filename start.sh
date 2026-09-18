#!/bin/sh
set -e

echo "🚀 Synchronizing SQLite database with Prisma schema..."
npx prisma db push --skip-generate --accept-data-loss || true

echo "✨ Starting AI Study Companion on port ${PORT:-3000}..."
exec node server.js
