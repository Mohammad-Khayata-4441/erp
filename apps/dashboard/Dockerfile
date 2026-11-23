FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

RUN echo "node-linker=hoisted" > .npmrc

RUN pnpm install --frozen-lockfile

# db-prisma generates the client that the dashboard's API types derive from.
RUN pnpm --filter @devloggers/db-prisma db:generate

# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4040
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build workspace dependencies only: the dashboard's `prebuild` calls the stale
# `@devloggers/api run generate` script, so we invoke `next build` directly and
# keep the committed OpenAPI artifacts (CI already guards their freshness).
RUN pnpm turbo run build --filter=@devloggers/dashboard^...

RUN pnpm --filter @devloggers/dashboard exec next build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "@devloggers/dashboard", "start"]
