# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies and build in one stage to save memory
COPY package*.json ./
RUN npm install

COPY . .
# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Automatically leverage output: 'standalone'
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
