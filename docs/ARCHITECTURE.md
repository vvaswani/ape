# Architecture Overview

## Purpose
- Provide policy-driven portfolio decision support for a human investor through a conversational UI and a deterministic Decision Snapshot.
- Convert user context and portfolio state into a governed recommendation that is auditable and reviewable.
- Enforce policy constraints and safe fallbacks before any recommendation is surfaced.

## Non-goals
- Trade execution, order routing, or money movement.
- Autonomous portfolio management without human decision ownership.
- Market prediction/alpha generation.
- Snapshot persistence, monitoring pipelines, or notifications (post-3c).

## Context
- Users / actors: end user (portfolio owner), system service, LLM provider.
- Environments: local Next.js runtime (`agent/`), optional Docker Compose stack.
- Key constraints: policy-first governance, deterministic drift math, fixed recommendation vocabulary, and safe behavior under missing/invalid inputs.

## High-level Components
> Describe responsibility boundaries, not code structure.

- **UI / Client:** Collects chat + structured `portfolio_state`, renders chat as supportive UX, and treats Decision Snapshot as authoritative output.
- **API / Service layer:** `POST /api/chat` validates request shape, orchestrates decision flow, applies guardrails, and emits snapshot.
- **User context (platform):** User identity is resolved only via `UserContextProvider`; domain/business logic must be user-scoped and must not read env/auth inputs directly.
- **Policy state repository (platform/data):** User-scoped policy lifecycle artifacts are persisted behind `PolicyStateRepository` (MVP `JsonPolicyStateRepository`) with storage root configured by `POLICY_STATE_DIR`.
- **Data store(s):** File-based policy/config artifacts (`artifacts/policy/default/*`, optional `artifacts/local/*`) are source of truth; no DB through Milestone 3c.
At runtime, policy must be provided via explicit configuration; repo artifacts are not valid runtime dependencies.
Policy follows a two-layer model: an immutable, release-scoped governance bundle (policy JSON + Prime Directive markdown) is baked into the build/image and loaded in production via `POLICY_DIR` (for example, `/app/policy`), while a versioned, data-scoped user policy instance is derived from questionnaire outputs and used to set SAA (rare updates) with regular TAA overlays constrained by governance guardrails.
- **Integrations:** LLM generation via Mastra agent abstraction; policy and explanation contract loaded from artifacts.
- **Jobs / schedulers (if any):** None in current scope.

## Data Model (at a glance)
- Core entities: `ChatRequest`, `PortfolioStateInput`, `PolicyJson`, `DecisionSnapshot`.
- Key identifiers: `snapshot_id`, `policy_id`, `policy_version`.
- Ownership / source of truth: deterministic evaluation fields owned by service logic + policy artifacts; recommendation/explanation text proposed by model then constrained by guardrails.
- Retention / archival assumptions: snapshots are returned per request only; policy lifecycle state persists as user-scoped repository records.

## Core Flows
### Flow A — Governed decision with structured state
1. UI sends chat history plus optional structured `portfolio_state` to `POST /api/chat`.
2. Service loads policy, validates/coerces state (with safe fallback path), computes deterministic drift/risk context.
3. LLM proposes recommendation/explanation JSON; guardrails + explanation contract enforce policy and snapshot is returned.

### Flow B — Missing or invalid state safety path
1. Request arrives without usable portfolio state (missing/incomplete/invalid).
2. Service avoids deterministic drift path and emits a constrained safe recommendation (`ASK_CLARIFYING_QUESTIONS` or `DEFER_AND_REVIEW`).
3. Snapshot includes warnings/audit notes so failure is visible and reviewable.

### Flow C — Policy integrity enforcement
1. Policy loader resolves local policy override first, then default policy artifact.
2. Prime Directive hash pin is checked against the relevant markdown artifact.
3. Decision run aborts with error if policy governance freeze is violated.

## Invariants (must never break)
- Decision Snapshot is the authoritative API/UI output; conversational text must not override it.
- Deterministic policy/drift constraints have precedence over model creativity.
- `recommendation.type` must remain within the closed enum.
- Unsafe/invalid model outputs must degrade to safe recommendation types, not silent success.
- Filesystem access for policy lifecycle persistence is confined to `JsonPolicyStateRepository` implementation boundaries.

## Observability (minimum)
- Logs: server logs for policy provenance, fallback reasons, guardrail/explanation warnings; client debug logging gated by log level.
- Metrics (if any): none implemented as first-class telemetry yet.
- Error handling strategy (brief): route catches unexpected errors; model/schema/guardrail failures are converted into safe snapshots whenever possible.

## Security & Access
- AuthN: none implemented for local MVP surface.
- AuthZ: authority intent and risk guardrails enforced in decision layer; no execution authority exists.
- Secrets management: provider API keys loaded from environment (`.env` / container env file).
- Data sensitivity notes: portfolio inputs are user-provided financial context; avoid logging secrets and keep artifacts local by default.

## External Interfaces
- Public endpoints: `POST /api/chat`.
- Webhooks / inbound: none.
- File formats / CSV contracts: JSON policy artifacts and markdown governance contracts in `artifacts/`.

## Links
- Decision log: `docs/decisions/`
- Change log: `docs/CHANGELOG.md`
