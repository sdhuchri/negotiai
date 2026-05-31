# Dev image for the Next.js frontend (Turbopack dev server).
# Debian-slim (glibc) for reliable sharp prebuilt binaries.
FROM node:24-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install

# Source is bind-mounted in dev (see docker-compose); this COPY is a fallback
# for standalone builds.
COPY . .

EXPOSE 3000

# -H 0.0.0.0 so the container port is reachable from the host mapping.
CMD ["npm", "run", "dev"]
