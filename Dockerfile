# Multi-stage build for Calendar Booking Application
# Uses clean Node.js without runtime dependencies

# Stage 1: Build/prepare the application
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install tsp compiler globally for TypeSpec compilation
RUN npm install -g @typespec/compiler@1.18.0 @typespec/http@1.18.0

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy TypeSpec source and generate OpenAPI
COPY typespec/ ./typespec/
RUN npx tsp compile ./typespec

# Copy source code and scripts
COPY src/ ./src/
COPY scripts/ ./scripts/

# Stage 2: Runtime image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/typespec/generated ./typespec/generated
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./

# Set environment variables defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV SLOT_MINUTES=15

# Expose the application port
EXPOSE ${PORT}

# Switch to non-root user
USER appuser

# Start the application automatically
CMD ["node", "src/server.js"]