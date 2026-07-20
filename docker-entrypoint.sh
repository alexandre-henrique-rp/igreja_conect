#!/bin/sh
set -e

mkdir -p /app/data

echo "Running prisma migrate deploy..."
pnpm exec prisma migrate deploy

echo "Starting application..."
exec pnpm start
