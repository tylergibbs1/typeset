FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN bun install --frozen-lockfile
RUN cd apps/api && bun build --compile --minify src/index.ts --outfile typeset-api

FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
    curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npx playwright install --with-deps chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/apps/api/typeset-api /usr/local/bin/typeset-api
EXPOSE 3000
CMD ["typeset-api"]
