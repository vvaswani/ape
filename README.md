# A.P.E aka Automated Portfolio Evaluator!

Meet APE - your AI-native portfolio advisor!

## Start

### Option A: Run with Docker (recommended)

1) Copy the env template and fill in at least one provider key:

```bash
cp .env.sample .env
```

- `GOOGLE_GENERATIVE_AI_API_KEY=...`  
  or `OPENAI_API_KEY=...`  
  or `ANTHROPIC_API_KEY=...`


2) Start the stack:

```bash
docker compose up --build
```

> Note: Docker reads local environment variables from `.env` via `docker-compose.yml` (`env_file`).
> Update `.env` for `LOG_LEVEL` or API keys.

3) Browse to:

* [http://localhost:3000](http://localhost:3000)

#### Tests (Docker)

Run the unit tests inside the container:

```bash
docker compose exec agent bun run test
```

Watch mode and coverage:

```bash
docker compose exec agent bun run test:watch
docker compose exec agent bun run test:coverage
```

Note: the container uses a named `node_modules` volume. If tests fail with `vitest: not found`,
run `docker compose exec agent bun install` once inside the running container.

### Option B: Run the agent app directly (no Docker)

```bash
cd agent
npm install
npm run dev
```

Then browse to:

* [http://localhost:3000](http://localhost:3000)

> Note: if you run without Docker, ensure your environment variables are available to the `agent` process
> (e.g., via `agent/.env.local` or your shell environment).

## Contributing

* This repository follows the Conventional Commits Specification for commits and pull requests.
* Run unit tests from the `agent/` directory: `npm run test`
* Milestone prefix required for code changes: `^[M<id>]` (e.g., `[M3c]`, `[M4a]`).
* Example: `[M3c] Enforce explanation contract`
* Docs-only changes (docs/ or *.md only) do not require a milestone prefix.
* See `.husky/commit-msg` for the exact enforcement rule.

### Tests (Local)

From `agent/`:

```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Repository layout

This repo is a single Git repository with a service-style structure:

* `agent/` — Next.js app (the primary UI/service)
* `docker-compose.yml` — local orchestration for running the system
* `artifacts/` — working area for generated outputs and local data (see notes below)
* `.env` — local-only configuration (not committed)

There is **no separate Git repo** under `agent/` (no nested `.git`).

## Artifacts (local working area)

`artifacts/` is intended as a practical workspace for outputs (exports, generated files, local datasets).

By default, local outputs under `artifacts/` are **not committed** to Git (see root `.gitignore`).
If you need to share something, prefer adding it under:

* `artifacts/examples/` (small, safe samples)
* `artifacts/templates/` (blank templates / schemas)

For anything large or sensitive, attach it to the ticket/PR instead of committing it.


## Docs

See `docs/README.md` for the canonical documentation index.

