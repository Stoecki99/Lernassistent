# =============================================================================
# Lernassistent — Multi-Stage Docker Build
# Stage 1 (deps):    Install production dependencies
# Stage 2 (builder): Generate Prisma Client + build Next.js
# Stage 3 (runner):  Minimal production image, non-root user
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# OpenSSL required by Prisma, build tools for native modules (bcrypt)
RUN apk add --no-cache openssl libc6-compat python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Builder
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone output)
# Dummy DATABASE_URL for build time — overridden at runtime
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ vars must be present at build time
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY=""
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production Runner
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl libc6-compat wget

# Non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone server + static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + generated client (needed at runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
