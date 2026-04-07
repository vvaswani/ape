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
- Repo-standard local test commands are `cd agent && npm test` and `cd agent && npm run test:coverage`.
- Treat direct PowerShell Vitest invocation (for example `npx vitest run`) as non-authoritative for this repo if it disagrees with the npm-script path.
- If tests cannot run, state the exact command attempted, the exact failure, and whether the issue is code-related or environment/setup-related.

## Error Handling Rule: Third-Route Trigger (Typed Codes)
- Rule:
- 1st occurrence: simplest handling is allowed.
- 2nd occurrence: duplication is tolerated but must be noted.
- 3rd occurrence: STOP and extract typed error codes first.
- Prohibited:
- Never introduce new substring-based mapping in a 3rd route.
- Never let `error.message.includes(...)` spread beyond the existing two routes; if none exist, avoid it entirely.
- When triggered:
- Introduce or extend minimal typed errors (`RepoError` + `code`).
- Update existing routes to use typed mapping.
- Implement the new route using typed codes.
- Keep the API error envelope unchanged.
- Scope guardrails:
- Do not extract a shared "error framework" unless 3+ routes need it.
- Keep mapping local unless and until a second route needs the same helper.
- Codex operating instruction:
- When implementing a new API route, Codex must first check whether the third-route trigger applies.
- If it applies, Codex must implement typed codes first (APE-61-style), then proceed.

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

## PR Workflow (Checkpointed, Codex-safe)
- Never work on `develop`; verify branch before edits and before commit.
- Do not merge or delete branches without explicit `continue`.
- Pre-flight (read-only) before any mutating command (`push` / PR create): run `git branch --show-current`, `git status`, `git diff --stat develop..HEAD`, and `git log --oneline --decorate -5`; then stop and wait for `continue`.
- Push (mutating) only after `continue`: run `git push -u origin <branch>`; then stop and wait for `continue`.
- PR creation (mutating) only after `continue`: create a real body file by running `mkdir -p tmp` and writing the PR body to `tmp/pr-<ticket>.md`; then create the PR with `gh prd --title "<ticket> — <title>" --body-file tmp/pr-<ticket>.md`.
- PR body rule: do not include internal file paths in PR descriptions.
- Post-PR pause: stop after PR creation for CI/review; do not merge or delete until explicit instruction.

## Standing Instruction
- Treat this file as a standing instruction for all future story implementation work in this repo.

## End of PR flow

- You have finished implementing the current story on a feature branch.

- Do the following in order, stopping after each step and waiting for my explicit “continue”:
- For step 2, use `gh prd` to open the PR (repo default: base `develop` on `harishkamathuk/ape`).

1) Push the feature branch to origin (if not already pushed).
2) Open a PR into `develop` (use a clear title + bullet summary + testing notes).
3) Pause for me to review the PR.
4) After my review, add/adjust PR description and leave PR comments where relevant (review notes, risks, follow-ups).
5) Pause again.
6) If the PR is safe (CI green + approvals + no unresolved threads), merge it using the standard repo method (squash or merge-commit—match existing convention).
7) Pause again.
8) Delete the feature branch from origin and locally.
9) Checkout `develop`, pull latest, and confirm clean status.

- At each pause: print what you did, links/commands used, and what’s next.
- Do not merge or delete anything without my explicit “continue”.
