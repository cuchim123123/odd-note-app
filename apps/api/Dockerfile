### Builder stage: install dev deps and build the API
FROM node:22-alpine3.18 AS builder
WORKDIR /workspace

# Copy workspace manifests and API package manifest
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/validation/package.json ./packages/validation/package.json

# Install pnpm and all deps (including dev) so we can build
RUN npm install -g pnpm@9
RUN pnpm install

# Copy source and build the API package
COPY . .

# Build validation package to JS for Node runtime in the container
RUN pnpm --filter @odd-note-app/validation build

WORKDIR /workspace/apps/api
RUN pnpm --filter @odd-note-app/api prisma:generate
RUN pnpm --filter @odd-note-app/api build


### Runtime stage: reuse the builder workspace to preserve pnpm links and generated Prisma client
FROM builder AS runtime
WORKDIR /workspace/apps/api

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "sleep 5 && npx prisma db push --accept-data-loss && node dist/main.js"]
