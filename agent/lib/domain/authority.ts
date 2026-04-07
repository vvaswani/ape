/**
 * @file authority.ts
 * @description
 * Minimal decision authority context for Milestone #1 enforcement.
 */

export type ActorRole = "USER" | "SYSTEM";

export type DecisionIntent = "ADVISE" | "APPROVE" | "EXECUTE";

export interface AuthorityContext {
  actor_role: ActorRole;
  decision_intent: DecisionIntent;
}
