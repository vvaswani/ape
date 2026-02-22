# AGENTS.md

## Branch Safety (Mandatory)
- NEVER implement code changes while checked out on `develop`.
- Before making any edits, run a branch check (for example, `git branch --show-current`).
- Before committing, run a branch check again.
- If the current branch is `develop`, create/switch to a feature branch before editing any files.
- If work starts on `develop` by mistake, immediately create/switch to a feature branch and carry uncommitted changes over; do not continue coding on `develop`.
- If no branch name is provided, use the repo-enforced format `<type>/APE-<id>-<short-slug>` (for example, `feat/APE-53-ips-save-draft`).

## Implementation Process
- Before editing, inspect existing patterns in the repo (route handlers, error responses, tests, dependency injection style) and follow them unless the story requires a new pattern.
- Run targeted tests for the changed scope first.
- Run the repo-standard full test command before final handoff when feasible.
- If tests cannot run, state the exact command attempted, the exact failure, and whether the issue is code-related or environment/setup-related.

## Docs Consistency Check
- Include a Doc Impact Check in the final summary for every story: `ARCHITECTURE` / `CHANGELOG` / `ADR` with yes/no and a one-line reason for each.
- Do not create/update `docs/ARCHITECTURE.md` or `docs/decisions/*` unless the story materially changes system structure, invariants, or durable architectural decisions.
- Update `docs/CHANGELOG.md` when behavior/API/runtime configuration/enforcement changes are user-visible or contract-visible.
- Keep changelog entries factual and concise; do not include internal file paths.

## Communication
- In final handoff, confirm the current branch name.
- Prefer user-facing wording in docs/changelog; keep internal implementation terms (for example, `upsert`) to code-level APIs when possible.

## PR Workflow (Repo-Specific)
- This repo opens PRs against `harishkamathuk/ape` with base branch `develop`.
- Prefer `gh prd` (GitHub CLI alias) for PR creation, which expands to `gh pr create -R harishkamathuk/ape --base develop`.
- Push feature branches to `origin` (fork), not `upstream`.

## Standing Instruction
- Treat this file as a standing instruction for all future story implementation work in this repo.
