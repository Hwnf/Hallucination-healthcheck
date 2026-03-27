import type { ResolvedContext } from "../types/context";
import type { HostPostTurnEvent, HostPreTurnEvent } from "../runtime/host-events";
import type { PreTurnInput } from "../runtime/hook-pre-turn";
import type { PostTurnInput } from "../runtime/hook-post-turn";

export interface OpenClawInboundEnvelope {
  agentId?: string;
  agentName?: string;
  agentKind?: string;
  userId?: string;
  conversationId?: string;
  companyId?: string;
  projectId?: string;
  provider?: string;
  channel?: string;
  surface?: string;
  messageId?: string;
  taskId?: string;
  lifecycleState?: string;
  roles?: string[];
  capabilities?: string[];
}

/**
 * OpenClaw adapter.
 *
 * Normalizes raw inbound runtime metadata into the plugin input shape expected
 * by the context resolver and hooks.
 */
export class DefaultOpenClawAdapter {
  normalizeInput(input: unknown): OpenClawInboundEnvelope {
    const obj = (input ?? {}) as Record<string, unknown>;

    return {
      agentId: obj.agentId ? String(obj.agentId) : undefined,
      agentName: obj.agentName ? String(obj.agentName) : undefined,
      agentKind: obj.agentKind ? String(obj.agentKind) : undefined,
      userId: obj.userId ? String(obj.userId) : undefined,
      conversationId: obj.conversationId ? String(obj.conversationId) : undefined,
      companyId: obj.companyId ? String(obj.companyId) : undefined,
      projectId: obj.projectId ? String(obj.projectId) : undefined,
      provider: obj.provider ? String(obj.provider) : undefined,
      channel: obj.channel ? String(obj.channel) : undefined,
      surface: obj.surface ? String(obj.surface) : undefined,
      messageId: obj.messageId ? String(obj.messageId) : undefined,
      taskId: obj.taskId ? String(obj.taskId) : undefined,
      lifecycleState: obj.lifecycleState ? String(obj.lifecycleState) : undefined,
      roles: Array.isArray(obj.roles) ? obj.roles.map(String) : undefined,
      capabilities: Array.isArray(obj.capabilities) ? obj.capabilities.map(String) : undefined,
    };
  }

  toResolvedContextSeed(input: OpenClawInboundEnvelope): Partial<ResolvedContext> {
    return {
      agentId: input.agentId,
      agentName: input.agentName,
      agentKind: input.agentKind,
      userId: input.userId,
      conversationId: input.conversationId,
      companyId: input.companyId,
      projectId: input.projectId,
      provider: input.provider ?? "unknown",
      channel: input.channel ?? "unknown",
      surface: input.surface ?? null,
      messageId: input.messageId ?? null,
      taskId: input.taskId ?? null,
      lifecycleState: input.lifecycleState ?? null,
      roles: input.roles ?? [],
      capabilities: input.capabilities ?? [],
    } as Partial<ResolvedContext>;
  }

  hostPreTurnToHookInput(event: HostPreTurnEvent): PreTurnInput {
    return {
      runtimeInput: event.runtimeInput,
      query: event.query,
      intent: event.intent,
    };
  }

  hostPostTurnToHookInput(event: HostPostTurnEvent): PostTurnInput {
    return {
      runtimeInput: event.runtimeInput,
      candidate: event.candidate,
    };
  }
}
