### Builder stage: install dev deps and build the API
FROM node:22-alpine3.18 AS builder
WORKDIR /workspace

# Copy workspace manifests and API package manifest
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json

# Install pnpm and all deps (including dev) so we can build
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source and build the API package
COPY . .
WORKDIR /workspace/apps/api
RUN pnpm --filter @odd-note-app/api build


### Final stage: runtime image with only production dependencies and built output
FROM node:22-alpine3.18 AS runtime
WORKDIR /usr/src/app

# Copy only the files needed to install production deps
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json

# Install only production dependencies (ignore lifecycle scripts)
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts from builder
COPY --from=builder /workspace/apps/api/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
