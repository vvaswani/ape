# Artifacts

This folder contains **governing documents and machine-readable artifacts** for the
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**.

The intent is to keep policy explicit, versioned, and reviewable.

---

## Folder Structure

```

artifacts/
policy/
template/
portfolio-guidelines.template.md
prime_directive.template.md
policy.template.json
default/
portfolio-guidelines.default.md
prime_directive.default.md
policy.default.json
local/
portfolio-guidelines.local.md
prime_directive.local.md
policy.local.json

```

---

## Three Policy Tiers

### 1) Template (placeholders, authoring-first)
**Location:** `artifacts/policy/template/`

Purpose:
- onboarding and documentation
- shows *what fields exist* and *how to fill them*
- contains placeholders (not intended for execution)

Rules:
- committed to the core repository
- not used at runtime

---

### 2) Default (dummy but valid, fail-safe runtime baseline)
**Location:** `artifacts/policy/default/`

Purpose:
- provides a conservative, schema-valid fallback
- ensures the application always has a working policy even with no local configuration

Rules:
- committed to the core repository
- must always be executable (no placeholders)

---

### 3) Local (private, user-specific working policy)
**Location:** `artifacts/local/`

Purpose:
- stores personal or environment-specific values
- enables customization without leaking into the core application repository

Rules:
- must not be committed to the core repository
- may be version controlled separately (e.g., private repo) if desired

---

## Runtime Precedence (Source of Truth)

At runtime, the application should resolve policy in this order:

1. `artifacts/local/policy.local.json` (if present)
2. `artifacts/policy/default/policy.default.json`
3. Template files are never used at runtime

This guarantees:
- personal override when available
- safe fallback when not

---

## Versioning and Change Control

All executable policy JSON files (default and local) should include:
- `policy_version`
- `updated_at`
- `source` (default or local)

Every decision record (Decision Snapshot) should capture:
- policy version used
- policy source used

No silent policy changes.

---

## Safety: Prevent Accidental Commits

Add the following to the repository `.gitignore`:

```

artifacts/local/
*.local.*

```

This prevents personal policy values from being committed accidentally.

---

# Appendix

## Why you usually do **NOT** want a local Explanation Contract

The **Explanation Contract is a governance artefact**, not a preference artefact.

Its job is to answer one question:

> *“What is the minimum standard of explanation that makes this system trustworthy?”*

That standard should be:

* stable,
* conservative,
* boring,
* and largely **user-agnostic**.

If every user (or even every environment) has its own explanation rules, you lose:

* comparability of decisions,
* audit consistency,
* and the ability to say “this explanation met the bar”.

In other words:
**policy values vary; explanation standards should not drift lightly.**

---

## Compare with Policy JSON (why that *does* get a local version)

| Artefact             | Should vary locally? | Why                                        |
| -------------------- | -------------------- | ------------------------------------------ |
| Portfolio Guidelines (Markdown)       | ✅ Yes                | Personal objectives and constraints differ |
| Policy JSON          | ✅ Yes                | Targets, bands, risk differ                |
| Explanation Contract | ❌ Usually no         | Trust standard should remain stable        |
| Decision Snapshot    | ❌ No                 | Audit record must be uniform               |

That asymmetry is intentional.

---

## When a local Explanation Contract *does* make sense

There are **only three legitimate cases**:

### 1️⃣ Different audience

Examples:

* Retail vs advised HNW
* Personal use vs client-facing
* Technical vs non-technical users

Then a *different* explanation standard is justified.

### 2️⃣ Regulatory or organisational requirements

Examples:

* FCA-style suitability wording
* Internal investment committee standards
* External audit expectations

This is governance-driven, not preference-driven.

### 3️⃣ Experimental phase (explicitly marked)

If you are **experimenting** with explanation style, you can allow a local override — but it must be:

* clearly labelled experimental
* versioned
* never silently applied

---

### Treat the Explanation Contract like a constitution amendment

If you ever want to change it:

* you edit **default**
* you bump the version
* all future Decision Snapshots reference the new version

That preserves historical integrity.



