# Title
ADR-0007: Introduce Policy State Repository (JSON-backed, Interface-first)

# Status
Accepted

# Date
2026-02-11

# Context
Policy lifecycle artifacts (IPS instance, risk profile, and portfolio guidelines instance) need persisted state that is user-scoped.
The boundary must be interface-first so JSON storage can be replaced later (for example, with PostgreSQL) without pushing filesystem concerns into domain logic.

# Decision
Introduce `PolicyStateRepository` as the persistence seam with methods for read and targeted upsert by `userId`:
- `getPolicyState(userId)`
- `upsertIps(userId, ips)`
- `upsertRiskProfile(userId, risk)`
- `upsertGuidelines(userId, guidelines)`

Adopt `JsonPolicyStateRepository` as the MVP implementation:
- one JSON file per user
- storage root configured via `POLICY_STATE_DIR`
- atomic writes via temp file + rename
- safe filename validation for `userId`
- deterministic JSON formatting

# Invariants
- All policy lifecycle persistence is keyed by `userId`.
- Filesystem access for policy lifecycle state is prohibited outside `JsonPolicyStateRepository`.
- Missing lifecycle data is explicit (`null`) and must not be inferred through silent defaults.
- Storage root is resolved from `POLICY_STATE_DIR` (with repository-defined default behavior).

# Consequences
- Positive: domain/service layers depend on a stable repository interface instead of filesystem details.
- Positive: user-scoped lifecycle records are deterministic and reviewable in MVP.
- Negative: JSON/file operational concerns remain in MVP until a backing store replacement is introduced.

# Options considered
- Direct filesystem reads/writes in services (rejected: leaks persistence mechanics beyond repository boundary).
- Introduce database persistence immediately (deferred: unnecessary complexity for current milestone scope).
- Keep lifecycle state in-memory only (rejected: does not satisfy persistence requirement).

# Follow-on work
- Add a DB-backed implementation behind the same `PolicyStateRepository` interface when multi-user scale and operational requirements justify it.
