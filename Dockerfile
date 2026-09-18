# ─────────────────────────────────────────────────────────────
# AI Study Companion - Production Multi-Stage Dockerfile
# Optimized for Render, Railway, Fly.io, and Docker Compose
# ─────────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install required system dependencies (openssl and libc6-compat for Prisma & SQLite)
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci

# Stage 2: Build the Next.js application
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client & build Next.js with standalone output
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user and persistent directories
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/prisma /app/public/uploads && \
    chown -R nextjs:nodejs /app

# Copy standalone build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy start script
COPY --chown=nextjs:nodejs start.sh /app/start.sh
RUN chmod +x /app/start.sh

USER nextjs

EXPOSE 3000

CMD ["/app/start.sh"]
