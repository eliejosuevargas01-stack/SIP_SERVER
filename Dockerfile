# --- BUILD STAGE ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source files
COPY . .

# Build the application (compiles client assets and bundles server.ts to dist/server.cjs)
RUN npm run build

# --- PRODUCTION STAGE ---
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package configs and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled build output from the builder stage
COPY --from=builder /app/dist ./dist

# Create a local directory for call recordings with correct volume permissions
RUN mkdir -p /app/recordings

# Expose port 3000 for the Express + WebRTC application
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.cjs"]
