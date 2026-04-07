# Plane Sync Automation

This repository includes an automated Plane sync workflow for pull requests.

## What It Does

When a pull request references a Plane key (default format: `APE-123`), GitHub Actions will:

- `opened` / `reopened`
  - Move the work item to **In Progress**
  - Add a comment with the PR link
- `ready_for_review`
  - Move the work item to **In Review**
  - Add a comment with the PR link
- `closed` with `merged == true`
  - Move the work item to **Done**
  - Add a comment with the PR link and merged summary

If no Plane key is found in branch name, PR title, or PR body, the workflow exits cleanly with no Plane API calls.

## Key Detection

The sync script checks these fields in order:

1. PR head branch (`pull_request.head.ref`)
2. PR title
3. PR body

Default regex shape:

`/(?:^|[^A-Z0-9])(APE-\d+)(?:[^A-Z0-9]|$)/i`

You can override `APE` via `PLANE_KEY_PREFIX`.

## Required Configuration

Set these in GitHub repository settings:

- `Secrets and variables` -> `Actions`
- Add token as a secret:
  - `PLANE_API_TOKEN` (required, secret)
- Add the rest as repository variables:
  - `PLANE_API_BASE_URL` (for cloud use `https://app.plane.so` or `https://api.plane.so`; for self-host, your API base URL)
  - `PLANE_WORKSPACE_SLUG`
  - `PLANE_PROJECT_ID`
  - `PLANE_STATE_IN_PROGRESS_ID`
  - `PLANE_STATE_IN_REVIEW_ID`
  - `PLANE_STATE_DONE_ID`
  - `PLANE_KEY_PREFIX` (optional, default `APE`)
  - `PLANE_SYNC_STRICT` (optional, default `false`)

### Plane API Key

1. In Plane, open workspace settings.
2. Create or copy an API key for the workspace.
3. Store it in GitHub Actions secret `PLANE_API_TOKEN`.

Never commit tokens in code or repo files.

## Finding State IDs

Use the helper script to list available states for your project.

PowerShell example:

```powershell
$env:PLANE_API_BASE_URL="https://api.plane.so"
$env:PLANE_API_TOKEN="<your-token>"
$env:PLANE_WORKSPACE_SLUG="your-workspace"
$env:PLANE_PROJECT_ID="<project-id>"
npx --yes tsx scripts/plane-discover-states.ts
```

Copy IDs from output into:

- `PLANE_STATE_IN_PROGRESS_ID`
- `PLANE_STATE_IN_REVIEW_ID`
- `PLANE_STATE_DONE_ID`

## Naming Examples

Any of these will be detected:

- Branch: `feature/APE-123-add-plane-sync`
- PR title: `APE-123: automate plane sync`
- PR body: `Implements behavior for APE-123`

## Local Testing

You can test `scripts/plane-sync.ts` locally with a saved GitHub event payload.

1. Save an example pull request event to `tmp/pr-event.json`.
2. Set env vars and run:

```powershell
$env:GITHUB_EVENT_PATH="tmp/pr-event.json"
$env:PLANE_API_BASE_URL="https://api.plane.so"
$env:PLANE_API_TOKEN="<your-token>"
$env:PLANE_WORKSPACE_SLUG="your-workspace"
$env:PLANE_PROJECT_ID="<project-id>"
$env:PLANE_STATE_IN_PROGRESS_ID="<state-id>"
$env:PLANE_STATE_IN_REVIEW_ID="<state-id>"
$env:PLANE_STATE_DONE_ID="<state-id>"
$env:PLANE_KEY_PREFIX="APE"
npx --yes tsx scripts/plane-sync.ts
```

Example minimal payload:

```json
{
  "action": "opened",
  "pull_request": {
    "number": 123,
    "title": "APE-123: automate sync",
    "body": "Sync Plane on PR events",
    "html_url": "https://github.com/org/repo/pull/123",
    "merged": false,
    "head": {
      "ref": "feature/APE-123-automate-sync"
    }
  }
}
```

## Failure Behavior

By default, sync failures are soft-fail (`PLANE_SYNC_STRICT=false`):

- Workflow logs the error
- Step exits success to avoid blocking merges

To enforce hard failure, set `PLANE_SYNC_STRICT=true`.
