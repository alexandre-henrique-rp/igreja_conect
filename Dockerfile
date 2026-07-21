FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@latest
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . /app
ENV DATABASE_URL="file:/app/data/prod.db"
RUN pnpm exec prisma generate
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/prod.db"
ENV STORAGE_PROVIDER=local
ENV STORAGE_LOCAL_DIR="/app/data/storage"
RUN apk add --no-cache ffmpeg
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY --from=build /app/generated /app/generated
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/prisma.config.ts /app/prisma.config.ts
COPY --from=build /app/scripts /app/scripts
COPY package.json pnpm-workspace.yaml .npmrc docker-entrypoint.sh ./
RUN mkdir -p /app/data
ENTRYPOINT ["./docker-entrypoint.sh"]