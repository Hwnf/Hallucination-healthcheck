import type { ContextResolver } from "../interfaces";
import type { ResolvedContext } from "../types/context";

/**
 * ContextResolver
 *
 * Normalizes raw runtime/control-plane input into a ResolvedContext.
 * This is a stub implementation and should later be wired to:
 * - OpenClaw inbound runtime metadata
 * - Paperclip assignment/project/company state
 * - registry defaults
 */
export class DefaultContextResolver implements ContextResolver {
  async resolve(input: unknown): Promise<ResolvedContext> {
    const nowIso = new Date().toISOString();
    const obj = (input ?? {}) as Record<string, unknown>;

    return {
      agentId: String(obj.agentId ?? "agent_orchestrator"),
      agentName: String(obj.agentName ?? "Orchestrator"),
      agentKind: String(obj.agentKind ?? "orchestrator"),
      userId: obj.userId ? String(obj.userId) : null,
      conversationId: obj.conversationId ? String(obj.conversationId) : null,
      companyId: obj.companyId ? String(obj.companyId) : null,
      projectId: obj.projectId ? String(obj.projectId) : null,
      provider: String(obj.provider ?? "unknown"),
      channel: String(obj.channel ?? "unknown"),
      surface: obj.surface ? String(obj.surface) : null,
      messageId: obj.messageId ? String(obj.messageId) : null,
      taskId: obj.taskId ? String(obj.taskId) : null,
      lifecycleState: obj.lifecycleState ? String(obj.lifecycleState) : null,
      roles: Array.isArray(obj.roles) ? obj.roles.map(String) : [],
      capabilities: Array.isArray(obj.capabilities) ? obj.capabilities.map(String) : [],
      nowIso,
    };
  }
}
