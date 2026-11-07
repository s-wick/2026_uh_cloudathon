# StoreOps API. Build for Graviton Fargate:
#   docker buildx build --platform linux/arm64 -t storeops-api app/api
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 8080
# Run node directly (no npm wrapper) so it receives SIGTERM for graceful shutdown.
CMD ["node", "src/server.js"]
