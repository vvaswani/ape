FROM oven/bun:1.1.8-alpine

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install

COPY . .

EXPOSE 4321

CMD ["bun", "run", "dev", "--", "--host"]
