#!/bin/sh
set -e

mkdir -p /app/data

echo "Running prisma migrate deploy..."
pnpm exec prisma migrate deploy

echo "Seeding if database is empty..."
pnpm db:seed-if-empty

echo "Starting application..."
exec pnpm start
