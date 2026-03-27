import type { ContextResolver, MetadataBuilder, SupermemoryClient, AclEngine } from "../interfaces";
import type { WriteCandidate } from "../types/lifecycle";
import { DefaultWriteGate } from "../policy/write-gate";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { DefaultOpenClawAdapter } from "../integrations/openclaw-adapter";
import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { RegistryCache } from "../registries/registry-cache";

export interface PostTurnInput {
  runtimeInput: unknown;
  candidate: WriteCandidate;
}

export interface PostTurnOutput {
  wrote: boolean;
  memoryId?: string | null;
  reason: string;
  paperclip?: {
    source: string | null;
    degraded: boolean;
    error: string | null;
  };
}

function shouldFailClosedWrite(targetScope: string, degradedRegistries: string[]): boolean {
  if (!degradedRegistries.length) return false;
  if (["governance", "restricted_shared", "agent_private", "user", "cold_storage"].includes(targetScope)) return true;
  if (degradedRegistries.includes("agents") && ["project", "company", "experience"].includes(targetScope)) return true;
  return false;
}

/**
 * Post-turn hook with OpenClaw + Paperclip enrichment.
 */
export class PostTurnHook {
  private readonly registryCache = new RegistryCache();

  constructor(
    private readonly contextResolver: ContextResolver,
    private readonly metadataBuilder: MetadataBuilder,
    private readonly supermemoryClient: SupermemoryClient,
    private readonly aclEngine: AclEngine,
    private readonly writeGate = new DefaultWriteGate(),
    private readonly auditLogger = new DefaultAuditLogger(),
    private readonly openclawAdapter = new DefaultOpenClawAdapter(),
    private readonly paperclipAdapter = new DefaultPaperclipAdapter(),
  ) {}

  async run(input: PostTurnInput): Promise<PostTurnOutput> {
    const normalized = this.openclawAdapter.normalizeInput(input.runtimeInput);
    const base = await this.contextResolver.resolve(normalized);
    const context = await this.paperclipAdapter.enrichContext(base);
    if (context.paperclipSourceOfTruth === "api-only" && context.paperclipDegraded) {
      return {
        wrote: false,
        reason: "post-turn blocked because Paperclip api-only source-of-truth is degraded",
        paperclip: {
          source: context.paperclipSource ?? null,
          degraded: true,
          error: context.paperclipError ?? null,
        },
      };
    }

    await this.registryCache.get();
    const registryHealth = this.registryCache.health();

    const degradedRegistries = registryHealth.issues.map((issue) => issue.registry);
    if (!registryHealth.ok) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "registry_health_warning",
        resourceId: input.candidate.targetContainer,
        reason: "post-turn executing with degraded registry health",
        metadata: {
          issues: registryHealth.issues,
          targetScope: input.candidate.targetScope,
          paperclipSource: context.paperclipSource ?? null,
          paperclipDegraded: context.paperclipDegraded ?? false,
          paperclipError: context.paperclipError ?? null,
        },
      });
    }

    if (shouldFailClosedWrite(input.candidate.targetScope, degradedRegistries) && context.agentId !== "agent_orchestrator") {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "write_fail_closed",
        resourceId: input.candidate.targetContainer,
        reason: "write blocked due to degraded registry health",
        metadata: {
          targetScope: input.candidate.targetScope,
          degradedRegistries,
          paperclipSource: context.paperclipSource ?? null,
          paperclipDegraded: context.paperclipDegraded ?? false,
          paperclipError: context.paperclipError ?? null,
        },
      });
      return {
        wrote: false,
        reason: `write blocked due to degraded registry health (${degradedRegistries.join(", ")})`,
        paperclip: {
          source: context.paperclipSource ?? null,
          degraded: context.paperclipDegraded ?? false,
          error: context.paperclipError ?? null,
        },
      };
    }

    const decision = await this.writeGate.decide(context, input.candidate);

    if (!decision.allowed) {
      if (decision.requiresAudit) {
        await this.auditLogger.log({
          timestamp: context.nowIso,
          actorId: context.agentId,
          action: "write_gate_denied",
          resourceId: input.candidate.targetContainer,
          reason: decision.reason,
          metadata: {
            targetScope: input.candidate.targetScope,
            lifecycleState: context.lifecycleState ?? null,
            paperclipSource: context.paperclipSource ?? null,
            paperclipDegraded: context.paperclipDegraded ?? false,
            paperclipError: context.paperclipError ?? null,
          },
        });
      }
      return {
        wrote: false,
        reason: decision.reason,
        paperclip: {
          source: context.paperclipSource ?? null,
          degraded: context.paperclipDegraded ?? false,
          error: context.paperclipError ?? null,
        },
      };
    }

    const acl = await this.aclEngine.can(context, "write", input.candidate.targetContainer);
    if (!acl.allowed) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "write_denied",
        resourceId: input.candidate.targetContainer,
        reason: acl.reason,
        metadata: {
          targetScope: input.candidate.targetScope,
          paperclipSource: context.paperclipSource ?? null,
          paperclipDegraded: context.paperclipDegraded ?? false,
          paperclipError: context.paperclipError ?? null,
        },
      });
      return {
        wrote: false,
        reason: `ACL denied write: ${acl.reason}`,
        paperclip: {
          source: context.paperclipSource ?? null,
          degraded: context.paperclipDegraded ?? false,
          error: context.paperclipError ?? null,
        },
      };
    }

    const record = await this.metadataBuilder.build(input.candidate, context);
    const result = await this.supermemoryClient.write(record);

    if (decision.requiresAudit || acl.requiresAudit) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "write",
        resourceId: result.memoryId,
        reason: decision.reason,
        metadata: {
          scope: input.candidate.targetScope,
          targetContainer: input.candidate.targetContainer,
          lifecycleState: context.lifecycleState ?? null,
          sourceType: record.sourceType ?? null,
          visibility: record.visibility,
          sensitivity: record.sensitivity ?? null,
          paperclipSource: context.paperclipSource ?? null,
          paperclipDegraded: context.paperclipDegraded ?? false,
          paperclipError: context.paperclipError ?? null,
        },
      });
    }

    return {
      wrote: true,
      memoryId: result.memoryId,
      reason: decision.reason,
      paperclip: {
        source: context.paperclipSource ?? null,
        degraded: context.paperclipDegraded ?? false,
        error: context.paperclipError ?? null,
      },
    };
  }
}
