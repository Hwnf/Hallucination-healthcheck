import type { MemoryScope } from "../types/memory";
import type { ResolvedContext } from "../types/context";

function canonicalArchiveMemoryId(projectId?: string | null): string {
  if (!projectId) return "archive_unknown";
  const normalized = projectId.startsWith("project_") ? projectId.slice("project_".length) : projectId;
  return `archive_project_${normalized}`;
}

export function scopeToResourceId(context: Partial<ResolvedContext>, scope: MemoryScope): string {
  switch (scope) {
    case "governance":
      return "gov_global";
    case "company":
      return context.companyId ?? "company_unknown";
    case "project":
      return context.projectId ?? "project_unknown";
    case "restricted_shared":
      return "restricted_default";
    case "agent_private":
      return `agent_${context.agentId ?? "unknown"}_private`;
    case "experience":
      return `experience_${context.agentId ?? "unknown"}`;
    case "user":
      return context.userId ? `user_${context.userId}` : "user_unknown";
    case "session":
      return context.conversationId ?? "session_unknown";
    case "cold_storage":
      return canonicalArchiveMemoryId(context.projectId);
    case "ephemeral":
      return context.conversationId ? `ephemeral_${context.conversationId}` : "ephemeral_unknown";
    default:
      return scope;
  }
}
