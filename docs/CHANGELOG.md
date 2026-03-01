# Iteration Change Log

## Format rules
- One section per iteration (date or version)
- Max ~10 bullets
- Capture *what changed* and *what to retest*
- No essays

---

## 2026-03-01 — Iteration APE-58 (Service-First Slice Completion Evidence)
### Changed:
- `POST /api/ips` supports saving an IPS draft for the current user.
- `POST /api/ips/freeze` freezes the current user’s IPS with idempotent `200` semantics when already frozen and `409` when no IPS exists.
- Dashboard lifecycle progression now reflects persisted IPS state: `NO_IPS -> IPS_DRAFT -> RISK_PROFILE_MISSING`.
- `/setup/ips` provides a minimal UI to save draft and freeze, and shows API status/payload responses plainly.

### Manual regression checks (quick):
- Use `/setup/ips` to save draft and confirm `200` response is shown, then `/dashboard` shows `IPS_DRAFT`.
- Use `/setup/ips` to freeze and confirm `200` response is shown, then `/dashboard` shows `RISK_PROFILE_MISSING`.
- Trigger freeze with no persisted IPS and confirm `409` is shown plainly (state reset may be required before this check).
- Send `POST /api/ips` with unknown fields and confirm `400` with `error.details.unknownFields`.

## 2026-02-28 — Iteration APE-61 (API Error Semantics Hardening)
### Changed
- API routes now map known repository failures using typed error codes rather than parsing error message substrings.
- Invalid user identifier failures are returned deterministically as `400` with `error.code = "BAD_REQUEST"` and `error.details.reason = "INVALID_USER_ID"`.

### Manual regression checks (quick)
- [ ] `POST /api/ips` with an invalid user context identifier returns `400` with `error.details.reason = "INVALID_USER_ID"`.
- [ ] `POST /api/ips/freeze` with an invalid user context identifier returns `400` with `error.details.reason = "INVALID_USER_ID"`.
- [ ] Unexpected internal repository errors still return `500` with a generic message and no stack details.

## 2026-02-22 — Iteration APE-60 (IPS Draft DTO Contract Hardening)
### Changed
- `POST /api/ips` now accepts a draft DTO with `content` and optional `ipsVersion` instead of the persistence-shaped IPS payload.
- Client-supplied IPS metadata fields (for example `status`, `createdAtIso`, `ipsSha256`) are rejected with `BAD_REQUEST`; the server/repository enforces `DRAFT` status and owns persisted metadata.
- `/setup/ips` now seeds and submits the draft DTO shape for save-draft testing.

### Manual regression checks (quick)
- [ ] Use `/setup/ips` to save a valid draft DTO and confirm `200` response is shown, then `/dashboard` shows `IPS_DRAFT`.
- [ ] Send `POST /api/ips` with extra fields like `status` or `ipsSha256` and confirm `400` with `error.details.unknownFields`.
- [ ] Use `/setup/ips` freeze after saving a draft and confirm freeze still returns `200` and `/dashboard` advances to `RISK_PROFILE_MISSING`.

## 2026-02-22 — Iteration APE-56 (Setup IPS UI API Exerciser)
### Changed
- `/setup/ips` now provides a minimal UI to save IPS drafts and call IPS freeze using the existing APIs.
- The page displays API response status and payload plainly for draft-save, freeze, and error paths.

### Manual regression checks (quick)
- [ ] Use `/setup/ips` to save a valid draft and confirm `200` response is shown, then `/dashboard` shows `IPS_DRAFT`.
- [ ] Use `/setup/ips` to freeze and confirm `200` response is shown, then `/dashboard` shows `RISK_PROFILE_MISSING`.
- [ ] Use `/setup/ips` freeze with no draft and confirm `409` error is shown plainly in the UI.

## 2026-02-22 — Iteration APE-55 (Dashboard Lifecycle Reflects Persisted IPS)
### Changed
- Dashboard now resolves and exposes the current lifecycle state and next CTA route from persisted policy state for the current user (server-side).
- Dashboard lifecycle/CTA output advances deterministically from IPS missing, IPS draft, and IPS frozen states using the existing lifecycle resolver and next-action mapping.

### Manual regression checks (quick)
- [ ] With no persisted IPS for the current user, `/dashboard` shows `NO_IPS` and next CTA route `/setup/ips`.
- [ ] After saving an IPS draft, `/dashboard` shows `IPS_DRAFT` and next CTA route `/setup/ips`.
- [ ] After freezing the IPS, `/dashboard` shows `RISK_PROFILE_MISSING` and next CTA route `/setup/risk-profile`.

## 2026-02-22 — Iteration APE-54 (IPS Freeze API)
### Added
- Added `POST /api/ips/freeze` to transition the current user’s IPS from `DRAFT` to `FROZEN` with deterministic state handling.
- Freeze returns `409` when no IPS draft exists and returns idempotent `200` when the IPS is already frozen.

### Manual regression checks (quick)
- [ ] `POST /api/ips/freeze` after saving a draft returns `200` with `{"status":"FROZEN"}`.
- [ ] `POST /api/ips/freeze` with no existing IPS draft returns `409` with `error.code = "CONFLICT"`.
- [ ] Repeating `POST /api/ips/freeze` after freeze returns `200` with `{"status":"FROZEN"}` and no content changes.

## 2026-02-22 — Iteration APE-53 (IPS Draft Save API)
### Added
- Added `POST /api/ips` to save (create/update) an IPS draft for the current user with explicit request validation and predictable error responses.

### Manual regression checks (quick)
- [ ] `curl -s -X POST http://localhost:3000/api/ips -H "Content-Type: application/json" --data "{\"ipsVersion\":\"v1\",\"ipsSha256\":\"abc123\",\"status\":\"DRAFT\",\"createdAtIso\":\"2026-02-22T00:00:00.000Z\",\"content\":\"IPS draft\"}"` returns `200` with `{"status":"DRAFT"}`.
- [ ] `curl -s -X POST http://localhost:3000/api/ips -H "Content-Type: application/json" --data "{\"ipsVersion\":\"v1\",\"ipsSha256\":\"abc123\",\"status\":\"FROZEN\",\"createdAtIso\":\"2026-02-22T00:00:00.000Z\",\"content\":\"IPS draft\"}"` returns `400` with `error.code = "BAD_REQUEST"`.
- [ ] `curl -s -X POST http://localhost:3000/api/ips -H "Content-Type: application/json" --data "{\"ipsVersion\":\"v1\"}"` returns `400` with `error.code = "BAD_REQUEST"`.

## 2026-02-22 — Iteration APE-50 (Snapshot Auditability Hardening)
### Changed
- Decision Snapshot API contract now includes machine-addressable `inputs_provenance` and `inputs_evaluated` fields for `risk_inputs` and `authority`.
- Snapshot output explicitly records missing governance input status in the new fields without using ambiguous nulls.
- Decision logic and guardrail outcomes remain unchanged; this is a contract hardening update only.

### Manual regression checks (quick)
- [ ] Snapshot responses include `inputs_provenance` and `inputs_evaluated` on supplied-input and missing-input paths.
- [ ] `inputs_evaluated.risk_inputs` is `false` when `risk_inputs` is missing.
- [ ] Representative scenario decisions (e.g., no-action, risk breach, unauthorized authority) remain unchanged.

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

