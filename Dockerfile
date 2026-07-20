FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.6.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . /app
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY package.json ./
CMD ["pnpm", "start"]