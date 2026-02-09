# Title
ADR-0005: Adopt baked governance policy bundle for production

# Status
Accepted

# Date
2026-02-09

# Context
The runtime policy loader precedence is `POLICY_PATH` → `POLICY_DIR` → repo `artifacts/...` only when `ALLOW_ARTIFACTS_READ="true"`, and that artifacts fallback is dev-only.
Production runtime must not depend on repo artifacts as policy/config dependencies.
Governance hash pinning is enforced through `meta.prime_directive_sha256`, so runtime policy resolution must preserve hash-verified policy + Prime Directive pairing.

# Decision
Adopt Option A for production: ship a release-scoped immutable governance policy bundle (policy JSON + Prime Directive markdown) baked into the build/image, and configure `POLICY_DIR` to that baked path (for example, `/app/policy`).
`ALLOW_ARTIFACTS_READ` is prohibited outside development contexts.
Runtime must fail fast on missing policy source or hash mismatch; there is no silent fallback to unpinned policies.

# Consequences
- Build/release pipelines must include the policy bundle and Prime Directive in the image and record bundle hashes plus image digest at build/release time.
- Production runtime configuration must provide `POLICY_DIR` to the baked bundle path.
- Local/dev workflows may use `ALLOW_ARTIFACTS_READ=true` only as an explicit non-default escape hatch.
- Operating model remains two-layered: governance bundle changes are limited to annual review + life events, while questionnaire outputs produce a versioned user policy instance (data) that sets SAA (rare updates) and constrains regularly run TAA.

# Alternatives considered
- Option B mounted directory (deferred).
- Option C remote config (rejected as unnecessary for current governance-change cadence).
- Continue reading repo artifacts at runtime (rejected).

# Notes / Links
- Current decision snapshots capture `policy_id`/`policy_version`/`policy_source` only; they do not yet capture policy/Prime hashes or path provenance.
- Audit defensibility relies on release metadata (image digest + policy bundle hashes) and referencing user policy instance version/digest in decisions.
- Related: `docs/decisions/ADR-0004-disallow-repo-artifacts-as-runtime-policy-dependencies.md`.