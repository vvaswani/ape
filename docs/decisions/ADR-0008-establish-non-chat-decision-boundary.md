# ADR-0008: Establish a canonical non-chat decision boundary

## Status
Accepted

## Context
APE already had deterministic decision execution behind `runDecision(...)`, but the active runtime path still depended on `POST /api/chat` and `/chat`.

That shape was inconsistent with the intended product architecture:
- APE is service-first and lifecycle-first.
- The dashboard is the control plane.
- Decision execution should sit behind a non-chat boundary with decision-native naming.

## Decision
- Make `POST /api/decisions` the canonical runtime boundary for decision execution.
- Make `/decisions` the authoritative UI surface that invokes that boundary.
- Keep `runDecision(...)` as the deterministic service core, but change its public contract from chat-shaped input to `DecisionRequest`.
- Treat typed fields on `DecisionRequest` as authoritative for decision execution. `request_note` is narrative context only and must not populate, override, or reconcile decision-driving inputs.
- Retire chat as a decision runtime boundary:
  - `/chat` redirects to `/decisions`
  - `POST /api/chat` returns `410 Gone` and points callers at `POST /api/decisions`

## Consequences
- Product runtime and tests now align on the same decision boundary.
- Long-term contracts use decision-native naming rather than conversational DTOs.
- Decision execution no longer accepts freeform note text as an alternate source for portfolio state.
- Any remaining conversational concepts are narrative context only, not decision-authoritative architecture.
