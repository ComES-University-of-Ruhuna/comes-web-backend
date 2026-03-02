# ============================================
# ComES Backend - Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# ------------------ Stage 1: Build ------------------
FROM node:20-alpine AS builder

# Install build dependencies needed for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency manifests first for optimal layer caching
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# ------------------ Stage 2: Production ------------------
FROM node:20-alpine AS production

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Set environment defaults
ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Create uploads directory with correct ownership
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Copy production dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy compiled output from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy package.json (needed for metadata/version info at runtime)
COPY --chown=appuser:appgroup package.json ./

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 5000

# Health check against the API health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
