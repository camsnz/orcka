# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.12.1

FROM node:${NODE_VERSION}-alpine AS builder
ARG PNPM_VERSION
WORKDIR /app

# Enable pnpm via corepack and install dependencies early to leverage caching
ENV COREPACK_ENABLE_STRICT=0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

# Build-time configuration values for the API locations
ARG VITE_AUDIT_ENGINE_URL="http://audit-engine:8080/info"
ARG VITE_INVOICE_API_URL="http://invoice-api:8000/info"
ENV VITE_AUDIT_ENGINE_URL=${VITE_AUDIT_ENGINE_URL}
ENV VITE_INVOICE_API_URL=${VITE_INVOICE_API_URL}

RUN pnpm build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
