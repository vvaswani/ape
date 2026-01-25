FROM oven/bun:1.3.4-alpine

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "dev"]
