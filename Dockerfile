FROM node:20-alpine

# Dependencias del sistema para Chromium + Prisma en Alpine 3.22
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  font-freefont \
  libstdc++ \
  openssl \
  libc6-compat
# Opcional: más cobertura de fuentes (si existen en tu mirror)
# RUN apk add --no-cache font-noto font-noto-cjk font-noto-emoji || true

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

EXPOSE 3001
CMD ["pnpm", "run", "start"]
