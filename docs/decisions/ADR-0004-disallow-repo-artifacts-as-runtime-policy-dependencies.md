# Title
Disallow repo artifacts as runtime policy dependencies

# Status
Accepted

# Date
2026-02-07

# Context
During Milestone 3b hardening, runtime policy loading in policyLoader.ts was found to read policy inputs directly from repo artifacts (artifacts/...).
This violates the system rule that runtime must not depend on repo artifacts.
A fix was implemented to remove unconditional artifact reads, require configuration-driven sources, and add tests that cover the new behavior.

# Decision
Runtime must not read policy/config directly from repo artifacts (artifacts/...).
Runtime policy sources must be provided explicitly via POLICY_PATH or POLICY_DIR.
If no policy source is configured, the system fails fast with a clear runtime error.
A dev-only escape hatch (ALLOW_ARTIFACTS_READ=true) may exist but must be explicitly gated and non-default.
Artifacts under artifacts/policy/default/* remain immutable and are not altered by this decision.

# Consequences
- Deployments must provide POLICY_PATH or POLICY_DIR for policy loading.
- Missing or misconfigured policy sources fail fast at runtime with a clear error.
- Local development can opt-in to legacy artifact reads only via an explicit flag.

# Alternatives considered
- Continue reading artifacts at runtime (rejected: violates the runtime/artifact boundary).
- Bundle policy into build output (rejected/deferred: adds build-time coupling and distribution complexity).

# Notes / Links
- agent/lib/infra/policyLoader.ts
- agent/lib/infra/policyLoader.test.ts
