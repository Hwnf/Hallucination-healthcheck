import type { RetrievalIntent } from "../types/retrieval";
import type { ContextResolver, ScopeRouter, RetrievalGate, SupermemoryClient, AclEngine } from "../interfaces";
import { scopeToResourceId } from "../utils/ids";
import { DefaultOpenClawAdapter } from "../integrations/openclaw-adapter";
import { DefaultPaperclipAdapter } from "../integrations/paperclip-adapter";
import { DefaultAuditLogger } from "../operations/audit-logger";
import { RegistryCache } from "../registries/registry-cache";

export interface PreTurnInput {
  runtimeInput: unknown;
  query: string;
  intent: RetrievalIntent;
}

export interface PreTurnOutput {
  contextBlock: string;
  selectedCount: number;
  allowedScopes: string[];
  deniedScopes?: Array<{ scope: string; reason: string }>;
  paperclip?: {
    source: string | null;
    degraded: boolean;
    error: string | null;
  };
}

/**
 * Pre-turn hook with OpenClaw + Paperclip enrichment.
 */
export class PreTurnHook {
  constructor(
    private readonly contextResolver: ContextResolver,
    private readonly scopeRouter: ScopeRouter,
    private readonly retrievalGate: RetrievalGate,
    private readonly supermemoryClient: SupermemoryClient,
    private readonly aclEngine: AclEngine,
    private readonly auditLogger = new DefaultAuditLogger(),
    private readonly registryCache = new RegistryCache(),
    private readonly openclawAdapter = new DefaultOpenClawAdapter(),
    private readonly paperclipAdapter = new DefaultPaperclipAdapter(),
  ) {}

  async run(input: PreTurnInput): Promise<PreTurnOutput> {
    const normalized = this.openclawAdapter.normalizeInput(input.runtimeInput);
    const base = await this.contextResolver.resolve(normalized);
    const context = await this.paperclipAdapter.enrichContext(base);
    if (context.paperclipSourceOfTruth === "api-only" && context.paperclipDegraded) {
      return {
        contextBlock: "[paperclip: api-only degraded; pre-turn blocked]",
        selectedCount: 0,
        allowedScopes: [],
        deniedScopes: [{ scope: "all", reason: "pre-turn blocked because Paperclip api-only source-of-truth is degraded" }],
        paperclip: {
          source: context.paperclipSource ?? null,
          degraded: true,
          error: context.paperclipError ?? null,
        },
      };
    }

    const route = await this.scopeRouter.route(context, input.intent);
    const includeArchived = route.allowColdStorage || ["archived", "closing"].includes(String(context.lifecycleState ?? "").toLowerCase());

    await this.registryCache.get();
    const registryHealth = this.registryCache.health();
    if (!registryHealth.ok) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "registry_health_warning",
        resourceId: null,
        reason: "pre-turn executing with degraded registry health",
        metadata: {
          intent: input.intent,
          issues: registryHealth.issues,
        },
      });
    }

    const allowedScopes: string[] = [];
    const deniedScopes: Array<{ scope: string; reason: string }> = [];
    for (const scope of route.orderedScopes) {
      const decision = await this.aclEngine.can(context, "read", scopeToResourceId(context, scope as any));
      if (decision.allowed) allowedScopes.push(scope);
      else deniedScopes.push({ scope, reason: decision.reason });
    }

    const effectiveAllowedScopes = registryHealth.ok
      ? allowedScopes
      : allowedScopes.filter((scope) => !["cold_storage", "agent_private", "user", "restricted_shared"].includes(scope));

    const degradedSensitiveScopes = allowedScopes.filter((scope) => !effectiveAllowedScopes.includes(scope));
    if (degradedSensitiveScopes.length) {
      deniedScopes.push(
        ...degradedSensitiveScopes.map((scope) => ({
          scope,
          reason: "fail-closed due to degraded registry health",
        })),
      );
    }

    const candidates = await this.supermemoryClient.search({
      context,
      intent: input.intent,
      query: input.query,
      scopes: effectiveAllowedScopes as any,
      includeArchived,
      includeSuperseded: false,
      limit: route.maxResultsPerScope,
    });

    const filtered = await this.retrievalGate.filter(
      {
        context,
        intent: input.intent,
        query: input.query,
        scopes: effectiveAllowedScopes as any,
        includeArchived,
        includeSuperseded: false,
        limit: route.maxResultsPerScope,
      },
      candidates,
    );

    const lines = filtered.selected.map((r, i) => {
      const summary = r.summary ?? r.content;
      return `${i + 1}. [${r.memoryScope}] ${summary}`;
    });

    const sensitiveRetrieved = filtered.selected.some((r) =>
      ["cold_storage", "agent_private", "user", "restricted_shared"].includes(String(r.memoryScope)),
    );

    if (sensitiveRetrieved || effectiveAllowedScopes.includes("cold_storage")) {
      await this.auditLogger.log({
        timestamp: context.nowIso,
        actorId: context.agentId,
        action: "retrieval_sensitive",
        resourceId: context.projectId ?? context.companyId ?? context.conversationId ?? null,
        reason: `pre-turn retrieval used sensitive/archive scopes for ${input.intent}`,
        metadata: {
          intent: input.intent,
          lifecycleState: context.lifecycleState ?? null,
          allowedScopes: effectiveAllowedScopes,
          deniedScopes,
          selectedScopes: filtered.selected.map((r) => r.memoryScope),
          paperclipSource: context.paperclipSource ?? null,
          paperclipDegraded: context.paperclipDegraded ?? false,
          paperclipError: context.paperclipError ?? null,
        },
      });
    }

    const healthPrefix = !registryHealth.ok
      ? `[registry-health: degraded; issues=${registryHealth.issues.map((i) => i.registry).join(", ")}]\n`
      : "";
    const paperclipPrefix = context.paperclipSource
      ? `[paperclip: source=${context.paperclipSource}; degraded=${context.paperclipDegraded ? "yes" : "no"}${context.paperclipError ? `; error=${context.paperclipError}` : ""}]\n`
      : "";

    return {
      contextBlock: `${healthPrefix}${paperclipPrefix}${lines.join("\n")}`,
      selectedCount: filtered.selected.length,
      allowedScopes: effectiveAllowedScopes,
      deniedScopes,
      paperclip: {
        source: context.paperclipSource ?? null,
        degraded: context.paperclipDegraded ?? false,
        error: context.paperclipError ?? null,
      },
    };
  }
}
