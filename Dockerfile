# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Setup the Express backend and serve the frontend
FROM node:20-alpine
WORKDIR /app

# Enable SQLite and build tools in Alpine
# gcompat helps with pre-built binaries expecting glibc
RUN apk add --no-cache python3 make g++ poppler-utils libc6-compat gcompat

# Copy backend package files and install production dependencies
WORKDIR /app/server
COPY --chown=node:node server/package*.json ./
# Build from source to ensure binary compatibility with Alpine
RUN npm install --build-from-source --omit=dev

# Copy backend source and built frontend with correct ownership at copy-time
# (avoids a slow `chown -R node:node /app` over thousands of node_modules files)
COPY --chown=node:node server/ ./
COPY --chown=node:node --from=frontend-builder /app/client/dist /app/client/dist

# Ensure writable dirs exist
RUN mkdir -p /app/server /app/client

# Switch to non-root user for security
USER node

EXPOSE 3001
CMD ["npm", "start"]
