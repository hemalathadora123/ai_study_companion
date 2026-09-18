# ─────────────────────────────────────────────────────────────
# AI Study Companion - Production Multi-Stage Dockerfile (Debian Slim)
# Optimized for Render, Railway, Fly.io, and Docker Compose
# ─────────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install openssl and certificates for Prisma & TLS
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies and ensure Linux prebuilt binary for lightningcss
RUN npm install && \
    npm install --no-save lightningcss-linux-x64-gnu@1.32.0 lightningcss-linux-arm64-gnu@1.32.0 || true && \
    if [ -f node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node ]; then \
      cp node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node node_modules/lightningcss/ 2>/dev/null || true; \
    fi

# Stage 2: Build Next.js application
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure lightningcss native binding is also copied into lightningcss directory
RUN if [ -f node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node ]; then \
      cp node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node node_modules/lightningcss/ 2>/dev/null || true; \
    fi

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client & build Next.js with standalone output
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user and persistent directories
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs && \
    mkdir -p /app/prisma /app/public/uploads && \
    chown -R nextjs:nodejs /app

# Copy standalone build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy startup script
COPY --chown=nextjs:nodejs start.sh /app/start.sh
RUN chmod +x /app/start.sh

USER nextjs

EXPOSE 3000

CMD ["/app/start.sh"]
