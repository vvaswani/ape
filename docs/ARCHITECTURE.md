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

## Documentation & Policy Boundaries
- Authoritative documents: `docs/ARCHITECTURE.md`, `docs/decisions/` (ADRs), and `docs/CHANGELOG.md`.
- Canonical policy sources (authoring): `artifacts/policy/default/*` with optional local authoring overrides in `artifacts/local/*`.
- Runtime policy loading is config-driven: `POLICY_PATH` -> `POLICY_DIR` -> repo artifacts only when `ALLOW_ARTIFACTS_READ=true` (dev/local only).
> Glossary: IPS = governance document; Portfolio Guidelines = operational rules derived from IPS; Risk Profile = questionnaire output selecting guidelines; Executable Guidelines = runtime policy JSON loaded via `POLICY_PATH`/`POLICY_DIR`.

## High-level Components
> Describe responsibility boundaries, not code structure.

- **UI / Client:** Dashboard-first lifecycle routing is the primary UX; chat remains available for governed decision support and treats Decision Snapshot as authoritative output.
- **API / Service layer:** `POST /api/chat` validates request shape, orchestrates decision flow, applies guardrails, and emits snapshot.
- **User context (platform):** User identity is resolved only via `UserContextProvider`; domain/business logic must be user-scoped and must not read env/auth inputs directly.
- **Policy state repository (platform/data):** User-scoped policy lifecycle artifacts are persisted behind `PolicyStateRepository` (MVP `JsonPolicyStateRepository`) with storage root configured by `POLICY_STATE_DIR`.
- **Data store(s):** Policy is version-controlled in `artifacts/policy/default/*` (with optional local authoring overrides in `artifacts/local/*`) as the authoring source of truth; no DB through Milestone 3c. Production runtime must consume the immutable, release-baked governance bundle (policy JSON + Prime Directive markdown) via `POLICY_DIR` (for example, `/app/policy`) and must not read repo artifacts as runtime dependencies. User policy lifecycle state remains versioned/data-scoped and persisted via `PolicyStateRepository`.
- **Integrations:** LLM generation via Mastra agent abstraction; runtime policy/explanation contract loaded from the `POLICY_DIR` governance bundle (artifacts remain authoring source).
- **Jobs / schedulers (if any):** None in current scope.

## Data Model (at a glance)
- Core entities: `ChatRequest`, `PortfolioStateInput`, `PolicyJson`, `DecisionSnapshot`.
- Key identifiers: `snapshot_id`, `policy_id`, `policy_version`.
- Ownership / source of truth: deterministic evaluation fields owned by service logic + runtime governance bundle (from `POLICY_DIR`, authored in artifacts); recommendation/explanation text proposed by model then constrained by guardrails.
- Retention / archival assumptions: snapshots are returned per request only; policy lifecycle state persists as user-scoped repository records.

### Policy Object Taxonomy
- **Investment Policy Statement (IPS):** governance-level policy defining objectives, constraints, authority model, and prohibited actions; versioned and changed deliberately.
- **Portfolio Guidelines:** operational rules derived from the IPS (asset allocation targets, rebalancing bands, turnover/execution controls, risk guardrails); versioned and adjusted through review/risk updates.
- **Risk Profile:** questionnaire-derived classification that selects or parameterizes Portfolio Guidelines; it does not mutate the IPS.
- **Executable Portfolio Guidelines (Runtime Policy):** deterministic machine-readable policy package loaded via `POLICY_PATH`/`POLICY_DIR` for runtime decision execution.

## Core Flows
Lifecycle ordering is explicit: IPS -> Risk Profile -> Portfolio Guidelines -> Executable Policy. Portfolio Guidelines must not be created during IPS setup.
Lifecycle order is enforced server-side via route guards using the same resolver path as the dashboard.
Lifecycle next-action routing is centralized in a single mapping used by both the dashboard CTA and server-side route guards.
### Canonical Policy Lifecycle Rule (APE)

> **In APE, the Investment Policy Statement (IPS) is established first and independently.
> Portfolio Guidelines are never created, selected, or modified during IPS setup.
> Portfolio Guidelines are derived only after a Risk Profile exists, and always within the constraints of the IPS.**

#### Authoritative sequencing (non-negotiable)

This sequence is **fixed** and must not be reordered:

1. **IPS Setup (Wizard)**
   * Purpose: establish governance, intent, and constraints
   * Output: **IPS Instance** (versioned, hashed, immutable)
   * Explicitly excludes:
     * asset allocation
     * rebalancing rules
     * execution preferences

2. **Risk Questionnaire**
   * Purpose: assess risk tolerance and capacity
   * Output: **Risk Profile** (versioned)

3. **Portfolio Guidelines Derivation**
   * Purpose: translate Risk Profile into operational rules
   * Input: IPS Instance + Risk Profile
   * Output: **Portfolio Guidelines Instance**

4. **Compilation**
   * Purpose: produce deterministic runtime configuration
   * Output: **Executable Portfolio Guidelines** (runtime policy JSON)

5. **Decision Execution**
   * Decisions are permitted only if a valid Executable Portfolio Guidelines package exists

#### Hard invariants (design constraints)

These are **system laws**, not conventions:

* An IPS **must exist** before a Risk Profile is interpreted
* Portfolio Guidelines **must not exist** without a Risk Profile
* Questionnaire results **must not mutate** the IPS
* Changes in risk posture **do not imply** IPS changes
* IPS changes require a **new IPS instance** (versioned), never in-place mutation

#### Adviser-aligned rationale (for future justification)

This mirrors orthodox advisory practice:

* IPS defines *permission and process*
* Risk assessment defines *posture*
* Portfolio construction implements *within policy*
* Policy changes only on review or life event

NOTE: Do not duplicate this content in other docs. ARCHITECTURE is authoritative.

### Flow A — Governed decision with structured state
1. UI sends chat history plus optional structured `portfolio_state` to `POST /api/chat`.
2. Service loads policy, validates/coerces state (with safe fallback path), computes deterministic drift/risk context.
3. LLM proposes recommendation/explanation JSON; guardrails + explanation contract enforce policy and snapshot is returned.

### Flow B — Missing or invalid state safety path
1. Request arrives without usable portfolio state (missing/incomplete/invalid).
2. Service avoids deterministic drift path and emits a constrained safe recommendation (`ASK_CLARIFYING_QUESTIONS` or `DEFER_AND_REVIEW`).
3. Snapshot includes warnings/audit notes so failure is visible and reviewable.

### Flow C — Policy integrity enforcement
1. Policy loader resolves runtime policy from explicit configuration (`POLICY_PATH` then `POLICY_DIR`), with artifact reads allowed only in dev/local via `ALLOW_ARTIFACTS_READ=true`.
2. Prime Directive hash pin is checked against the relevant markdown artifact.
3. Decision run aborts with error if policy governance freeze is violated.

## Invariants (must never break)
- Decision Snapshot is the authoritative API/UI output; conversational text must not override it.
- Deterministic policy/drift constraints have precedence over model creativity.
- `recommendation.type` must remain within the closed enum.
- Unsafe/invalid model outputs must degrade to safe recommendation types, not silent success.
- Filesystem access for policy lifecycle persistence is confined to `JsonPolicyStateRepository` implementation boundaries.
- If portfolio_state exists, the system must never request weights.
- When `portfolio_state.weights` are provided, values are decimals (0-1); incomplete/missing weights must trigger a safe path rather than 500.
- Expected validation/model failures must return safe snapshot outcomes and should not surface as HTTP 500.

## Observability (minimum)
- Logs: server logs for policy provenance, fallback reasons, guardrail/explanation warnings; client debug logging gated by log level.
- Metrics (if any): none implemented as first-class telemetry yet.
- Error handling strategy (brief): route catches unexpected errors; model/schema/guardrail failures are converted into safe snapshots whenever possible.

## Security & Access
- AuthN: none implemented for local MVP surface.
- AuthZ: authority intent and risk guardrails enforced in decision layer; no execution authority exists.
- Secrets management: provider API keys loaded from environment (`.env` / container env file).
- Data sensitivity notes: portfolio inputs are user-provided financial context; avoid logging secrets and keep policy bundles local by default in dev while production uses a release-baked bundle.

## External Interfaces
- Public endpoints: `POST /api/chat`.
- Webhooks / inbound: none.
- File formats / CSV contracts: JSON policy artifacts and markdown governance contracts in `artifacts/`.

## Links
- Decision log: `docs/decisions/`
- Change log: `docs/CHANGELOG.md`


