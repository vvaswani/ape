# User story: User context abstraction for user-scoped policy lifecycle

## Background / Why
APE needs a platform seam for user identity so policy lifecycle and persistence can become user-scoped without leaking env/auth concerns into domain logic.
MVP remains deterministic and local-user based, but implementation boundaries must be future-ready.

## Acceptance criteria
- User identity is resolved only via `UserContextProvider`.
- `LocalUserContextProvider` is the only location allowed to read `DEFAULT_USER_ID` and `DEFAULT_USER_NAME`.
- New code paths do not hard-code `"local"` outside provider defaults.
- Business/domain logic accepts `userId` as an injected/input dependency and does not resolve identity internally.
- `authType` is descriptive only in MVP and is not used for authorization decisions.

## Test expectations
- Unit tests verify provider default output shape (`userId`, `displayName`, `authType`) and deterministic values.
- Unit tests verify env overrides for `DEFAULT_USER_ID` and `DEFAULT_USER_NAME`.
- Guardrail test expectation: no direct env reads for default user identity outside `LocalUserContextProvider`.
- Service-level test expectation: user-scoped flows pass/use a consistent `userId` dependency.

## Out of scope
- Real authentication or session management flows.
- Full multi-user persistence implementation.
- Routing/UI/dashboard changes.

## Links
- ADR: `docs/decisions/ADR-0006-introduce-user-context-abstraction.md`
- Architecture: `docs/ARCHITECTURE.md`
- Changelog: `docs/CHANGELOG.md`
