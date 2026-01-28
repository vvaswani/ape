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

3) Browse to:

* [http://localhost:3000](http://localhost:3000)

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


## Docs -- TODO

* Decision API spec
* Artifacts conventions
* Policy file conventions

