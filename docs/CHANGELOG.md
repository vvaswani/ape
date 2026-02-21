# Iteration Change Log

## Format rules
- One section per iteration (date or version)
- Max ~10 bullets
- Capture *what changed* and *what to retest*
- No essays

---

## 2026-02-21 — Default landing route: /dashboard
### Changed
- Visiting `/` now performs a server-side redirect to `/dashboard` (dashboard is the default landing route).
- Chat UI remains reachable at `/chat` (moved from `/`).
- Server-side route guards enforce lifecycle order for `/decisions`, `/setup/risk-profile`, and `/setup/guidelines` (redirect to `/dashboard` when disallowed).
- Centralized lifecycle next-action mapping to prevent dashboard/guard routing divergence.

### Added
- `/chat` route.

### Manual regression checks (quick)
- Visiting `/` redirects to `/dashboard`.
- Visiting `/chat` renders the chat UI.
- `/dashboard` still renders as expected.

---

## 2026-02-11 — Iteration M4 (User Context Abstraction Seam)
### Added
- Introduced `UserContextProvider` seam with `LocalUserContextProvider` (env-backed defaults via `DEFAULT_USER_ID` and `DEFAULT_USER_NAME`) to keep identity resolution platform-scoped.

---

## 2026-02-11 — Iteration M4a (Policy State Repository Seam)
### Added
- Added `PolicyStateRepository` seam with `JsonPolicyStateRepository` MVP for user-scoped policy lifecycle artifacts.
- Added `POLICY_STATE_DIR` runtime configuration for policy state storage root.
- Missing lifecycle artifacts are represented explicitly as `null` (no silent defaults).

## 2026-02-11 — Iteration M4b (Docs Consolidation)
### Changed
- Docs consolidation: removed non-authoritative duplicates; clarified authoritative doc set and policy loading boundary.
- Terminology: rename IPM -> Portfolio Guidelines (CFA-aligned); no behavior changes.
- Docs: added canonical policy lifecycle rule and invariants (IPS -> Risk Profile -> Portfolio Guidelines -> Executable Guidelines).
- Docs: standardized policy object taxonomy across architecture/ADRs (IPS, Portfolio Guidelines, Risk Profile, Executable Portfolio Guidelines).
- Docs: codified non-negotiable policy lifecycle invariant (IPS precedes Risk Profile; Guidelines derived only after Risk Profile).

---

## 2026-02-13 — Iteration M4c (Dashboard Lifecycle State)
### Added
- Server-side dashboard loader computes lifecycle state for current user using `UserContextProvider` + `PolicyStateRepository` + `resolveLifecycleState`.
- `/dashboard` displays the computed lifecycle state value.
- Stub server routes for dashboard CTA destinations: `/setup/ips`, `/setup/risk-profile`, `/setup/guidelines`, and `/decisions`.
- Each route renders a minimal Server Component with a title and `Not implemented.` placeholder.

### Non-goals
- No forms or persistence changes.
- No API routes.
- No route guards or middleware.

### Manual regression checks (quick)
- [ ] Each route returns 200.
- [ ] Each page displays the correct title.
- [ ] No client components or client hooks introduced.

---

## 2026-01-27 — Iteration M1 (Policy Enforcement Baseline)
### Added
- Policy loader with default/local artifact resolution and governance hash freeze checks.
- Deterministic guardrails for authority intent, risk capacity, prohibited actions, and drift boundary enforcement.
- Milestone 1 manual QA scenarios and service-level tests for enforcement behavior.

### Changed
- Decision API contract clarified around deterministic snapshot ownership and safe fallbacks.

### Fixed
- N/A

### Removed
- N/A

### Data / Schema
- Introduced policy JSON contract usage (`artifacts/policy/default/policy.default.json`) as runtime source of truth.

### Risks / Follow-ups
- Snapshot persistence and execution workflows remain intentionally out of scope.

### Manual regression checks (quick)
- [ ] Prohibited action prompt downgrades to safe recommendation.
- [ ] Risk-capacity breach path produces `DEFER_AND_REVIEW`.
- [ ] Prime Directive hash mismatch fails policy load.

---

## 2026-01-30 — Iteration M3b (Snapshot Correctness & Deterministic Guardrails)
### Added
- Structured `portfolio_state` input pathway and deterministic drift computation.
- Contradiction guardrails that reject model outputs conflicting with deterministic facts.
- Canonical scenario coverage for in-band, out-of-band, and contribution-led recommendations.

### Changed
- Decision service now treats deterministic fields (drift/policy provenance) as code-owned and model text as constrained.

### Fixed
- Prompt/state precedence edge cases and drift tolerance behavior in tests.

### Removed
- N/A

### Data / Schema
- Decision Snapshot contract expanded to consistently carry drift analysis and policy-applied context.

### Risks / Follow-ups
- Structured machine-readable guardrail override schema remains partial (warnings primarily serialized as text notes).

### Manual regression checks (quick)
- [ ] In-band + no cash flows returns `DO_NOTHING`.
- [ ] Out-of-band + no cash flows returns `REBALANCE`.
- [ ] In-band + contributions returns `REBALANCE_VIA_CONTRIBUTIONS`.

---

## 2026-02-01 — Iteration M3c (Recommendation Typing & Explanation Discipline)
### Added
- Closed recommendation typing enforcement and explanation-contract validation with safe downgrade behavior.
- Manual Milestone 3c scenario suite (including prompt invariance and missing-state checks).
- Test coverage for explanation contract and guardrail override explanation behavior.

### Changed
- Guardrail/explanation override paths now explicitly rewrite explanation fields when model output is non-compliant.

### Fixed
- Deterministic policy basis injection to avoid ambiguous or non-policy-referential explanation text.

### Removed
- N/A

### Data / Schema
- Milestone boundary inferred from cohesive commit/test set and docs under `docs/reference/tests/milestone-3c` because no explicit release tag is present.

### Risks / Follow-ups
- Full structured audit reason-codes remain a follow-up before later milestones.

### Manual regression checks (quick)
- [ ] Prompt rephrasing does not change `recommendation.type` for equivalent facts.
- [ ] Missing portfolio state yields `ASK_CLARIFYING_QUESTIONS`.
- [ ] Explanation omissions trigger safe `DEFER_AND_REVIEW` downgrade.

---

## 2026-02-07 — Iteration M3a (Snapshot Contract Retrofit & Observability Fields)
### Added
- Decision Snapshot contract fields: `outcome_state`, `inputs_observed`, `inputs_missing`, `policy_items_referenced`, `warnings[]`, `errors[]` (structured).
- Golden snapshot artifact for in-band / no-cashflows scenario under `artifacts/reference/milestone-3a/`.
- Contract validation tests including negative validation coverage.

### Changed
- Decision service now returns snapshot-shaped error responses for invalid requests.
- Missing or incomplete inputs produce explicit missing-input outcomes rather than silent failure.

### Fixed
- N/A

### Removed
- N/A

### Data / Schema
- Decision Snapshot contract expanded to include explicit outcome state, input provenance, policy references, and structured warnings/errors.

### Risks / Follow-ups
- Policy application details (`policy_applied`) and expanded guardrails remain out of scope for M3a.

### Manual regression checks (quick)
- [ ] Invalid request returns snapshot with populated `outcome_state` and structured `errors[]`.
- [ ] Missing inputs populate `inputs_missing[]` and yield a safe missing-input outcome.
- [ ] Normal in-band path includes at least one `policy_items_referenced` DPQ id.

---

## 2026-02-07 — Iteration M3b (Show Your Work)
### Added
- Evaluation fields for policy application (`policy_applied`), deterministic drift (`drift`), and correctness (`correctness`).
- Contradiction rejection with deterministic fail status and structured error codes.
- Golden reference snapshots under `artifacts/reference/milestone-3b/` (reference outputs only).
- Dev-only escape hatch: `ALLOW_ARTIFACTS_READ=true` to permit artifact reads in local/dev scenarios (non-default).
- Unit tests enforcing “no artifacts read by default” and “missing config fails fast”.

### Changed
- If `portfolio_state` exists, the system never asks for weights.
- Deterministic drift and policy application details are now explicit in snapshots.
- Runtime policy loading now requires explicit configuration via `POLICY_PATH` or `POLICY_DIR`; runtime no longer reads policy directly from repo `artifacts/...`.
- If no policy source is configured, the service fails fast with a clear runtime error.
- Standardised production runtime policy delivery on a baked governance bundle via `POLICY_DIR` (for example, `/app/policy`); repo `artifacts/...` are not valid runtime dependencies in production.

### Fixed
- N/A

### Removed
- N/A

### Data / Schema
- Decision Snapshot evaluation section expanded to include policy-applied provenance, drift status, and correctness status.

### Risks / Follow-ups
- M3c guardrail expansions remain out of scope.
- Decision Snapshot schema currently captures `policy_id`/`policy_version`/`policy_source` but not policy/prime hashes or path provenance; audit defensibility relies on release metadata (image digest + policy bundle hashes) plus referenced user policy instance version/digest.

### Manual regression checks (quick)
- [ ] Portfolio state present → no request for weights; drift status is deterministic.
- [ ] Contradiction between model output and deterministic expectation yields `correctness=fail`.
- [ ] Drift evaluation is populated or explicitly marked not applicable/cannot compute.
- [ ] With no `POLICY_PATH`/`POLICY_DIR`, startup/request fails fast (no silent artifacts fallback).
- [ ] With `POLICY_PATH` or `POLICY_DIR` set, policy loads successfully and snapshot includes normal policy provenance.
- [ ] In production, `POLICY_DIR` points to the baked bundle path and prime directive hash pinning is enforced.
- [ ] With `ALLOW_ARTIFACTS_READ=true` (dev only), artifact-based policy load is permitted; without it, artifact reads are rejected.

### Tests
- `cd agent && npm test`

### Paths touched
- `agent/lib/domain/decisionSnapshot.ts`
- `agent/lib/services/decisionService.ts`
- `agent/lib/services/decisionSnapshotContract.m3b.test.ts`
- `artifacts/reference/milestone-3b/*`

---
## Milestone 3c Marker
Backfilled documentation is complete through Milestone 3c.

