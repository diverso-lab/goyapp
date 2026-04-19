#!/bin/sh
set -e

echo "→ prisma db push"
npx prisma db push --skip-generate --accept-data-loss

echo "→ seed"
npx tsx prisma/seed.ts || echo "seed skipped/failed (non-fatal)"

echo "→ starting Next.js"
exec node server.js
