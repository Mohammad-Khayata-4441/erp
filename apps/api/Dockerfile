FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

# Hoisted layout keeps Prisma engines and workspace binaries resolvable in a
# single-image monorepo build.
RUN echo "node-linker=hoisted" > .npmrc

RUN pnpm install --frozen-lockfile

# db-prisma generates the client that api-contracts and the API type against.
RUN pnpm --filter @devloggers/db-prisma db:generate
RUN pnpm turbo run build --filter=@devloggers/api...

RUN mkdir -p /app/uploads && \
    if [ -d "apps/api/uploads" ] && [ "$(ls -A apps/api/uploads 2>/dev/null)" ]; then \
    cp -r apps/api/uploads/. /app/uploads/ || true; \
    fi

VOLUME ["/app/uploads"]

ENV NODE_ENV=production
EXPOSE 4040

CMD ["node", "apps/api/dist/main"]
