import type { ScopeRouter } from "../interfaces";
import type { ResolvedContext } from "../types/context";
import type { RetrievalIntent, ScopeRoute } from "../types/retrieval";

function isArchivedLifecycle(context: ResolvedContext): boolean {
  return ["archived", "closing"].includes(String(context.lifecycleState ?? "").toLowerCase());
}

/**
 * Scope routing stub based on Blueprint v2 defaults.
 *
 * Hardened behavior:
 * - archived/closing projects bias away from normal project retrieval
 * - precedent/archive intents can favor cold storage earlier when lifecycle demands it
 */
export class DefaultScopeRouter implements ScopeRouter {
  async route(context: ResolvedContext, intent: RetrievalIntent): Promise<ScopeRoute> {
    const archived = isArchivedLifecycle(context);

    switch (intent) {
      case "active_project":
        return {
          intent,
          orderedScopes: archived
            ? ["session", "ephemeral", "company", "experience", "cold_storage"]
            : ["session", "ephemeral", "project", "restricted_shared", "user", "company", "governance", "experience"],
          allowColdStorage: archived,
          maxResultsPerScope: 5,
        };
      case "policy_lookup":
        return { intent, orderedScopes: ["governance", "restricted_shared", "company", "project"], allowColdStorage: false, maxResultsPerScope: 5 };
      case "user_personalization":
        return { intent, orderedScopes: ["user", "session", "project"], allowColdStorage: false, maxResultsPerScope: 5 };
      case "precedent_lookup":
        return {
          intent,
          orderedScopes: archived
            ? ["cold_storage", "experience", "company", "project"]
            : ["project", "experience", "company", "cold_storage"],
          allowColdStorage: true,
          maxResultsPerScope: 5,
        };
      case "agent_self_recall":
        return { intent, orderedScopes: ["agent_private", "experience", "project", "company"], allowColdStorage: false, maxResultsPerScope: 5 };
      case "closeout":
        return { intent, orderedScopes: ["project", "experience", "company", "governance"], allowColdStorage: false, maxResultsPerScope: 5 };
      case "archive_lookup":
        return { intent, orderedScopes: ["cold_storage"], allowColdStorage: true, maxResultsPerScope: 5 };
      default:
        return { intent, orderedScopes: ["session", "project", "company"], allowColdStorage: false, maxResultsPerScope: 5 };
    }
  }
}
