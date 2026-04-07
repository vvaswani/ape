# Title
ADR-0006: Introduce User Context Abstraction (Interface-first, Local Implementation)

# Status
Accepted

# Date
2026-02-11

# Context
Current MVP behavior is effectively single-user, but user identity concerns were at risk of spreading across services via direct env reads and hard-coded IDs.
We need a seam that keeps runtime behavior unchanged while enabling future user-scoped lifecycle/persistence work.

# Decision
Introduce a platform-level `UserContextProvider` abstraction:
- `User`: `userId`, `displayName`, `authType`
- `UserContextProvider#getCurrentUser(): User` (synchronous for MVP)
- `LocalUserContextProvider` as MVP implementation, reading `DEFAULT_USER_ID` and `DEFAULT_USER_NAME` with defaults `"local"` and `"Local User"`, and `authType: "LOCAL_FAKE"`

# Invariants
- All user resolution must go through `UserContextProvider`.
- Direct access to `process.env.DEFAULT_USER_ID` or `process.env.DEFAULT_USER_NAME` is prohibited outside `LocalUserContextProvider`.
- New code paths must not hard-code `"local"` outside `LocalUserContextProvider` defaults.
- Business/domain logic must accept `userId` as an input dependency; it must not resolve identity internally.
- `authType` is descriptive metadata in MVP and must not drive authorization decisions.

# Consequences
- Positive: identity resolution is centralized, deterministic for MVP, and replaceable later without refactoring domain boundaries.
- Positive: future multi-user policy lifecycle/persistence can be introduced behind the same seam.
- Negative: code touching user-scoped behavior must explicitly thread `userId`.

# Alternatives considered
- Continue direct env reads in services (rejected: leaks platform concerns into domain logic).
- Hard-code a global local user everywhere (rejected: blocks clean multi-user evolution).
- Add full auth now (rejected: out of scope for MVP milestones).

# Notes / Links
- Related architecture update: `docs/ARCHITECTURE.md`
- Related changelog entry: `docs/CHANGELOG.md`
