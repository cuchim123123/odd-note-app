FROM node:22-alpine AS builder
WORKDIR /workspace

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/validation/package.json ./packages/validation/package.json

RUN npm install -g pnpm@9
RUN pnpm install

COPY . .

WORKDIR /workspace/apps/web

# Set the API URL for the production build
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm build

# Serve with Nginx
FROM nginx:alpine AS runtime
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

# Handle client-side routing and reverse proxying for production
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
