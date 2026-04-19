#!/bin/sh
set -e

echo "→ prisma migrate deploy"
npx prisma migrate deploy

echo "→ seed"
npx tsx prisma/seed.ts || echo "seed skipped/failed (non-fatal)"

echo "→ starting Next.js"
exec node server.js
