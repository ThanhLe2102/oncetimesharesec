# Local / compose image: production Next.js build with Prisma CLI available for migrate deploy.
FROM node:20-bookworm-slim AS base

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci

COPY prisma ./prisma

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# DATABASE_URL must be set at runtime (see docker-compose.yml).
CMD ["sh", "-c", "npx prisma migrate deploy && exec ./node_modules/.bin/next start"]
