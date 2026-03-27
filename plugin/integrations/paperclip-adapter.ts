import type { ResolvedContext } from "../types/context";
import {
  ApiPaperclipClient,
  RegistryPaperclipClient,
  type PaperclipClient,
  type PaperclipResolvedState,
} from "./paperclip-client";

export interface PaperclipAdapterOptions {
  client?: PaperclipClient;
  mode?: "registry" | "api";
  sourceOfTruth?: "registry-only" | "api-preferred" | "api-only";
  apiBaseUrl?: string;
  apiKey?: string;
  fallbackToRegistryOnError?: boolean;
  cacheTtlMs?: number;
}

export interface PaperclipAdapterStatus {
  source: "api" | "registry" | "registry-fallback" | "cache" | null;
  degraded: boolean;
  lastError: string | null;
  cacheHit: boolean;
  sourceOfTruth: "registry-only" | "api-preferred" | "api-only";
}

interface CachedStateEntry {
  key: string;
  storedAt: number;
  state: PaperclipResolvedState;
}

function selectApiClient(options: PaperclipAdapterOptions = {}): PaperclipClient {
  return new ApiPaperclipClient({
    baseUrl: options.apiBaseUrl ?? process.env.PAPERCLIP_API_BASE_URL ?? "http://paperclip.local",
    apiKey: options.apiKey ?? process.env.PAPERCLIP_API_KEY,
  });
}

function makeCacheKey(context: ResolvedContext): string {
  return [
    context.agentId ?? "",
    context.projectId ?? "",
    context.companyId ?? "",
    context.conversationId ?? "",
    context.lifecycleState ?? "",
  ].join("|");
}

function enrichFromState<T extends ResolvedContext>(
  context: T,
  state: PaperclipResolvedState,
  status: PaperclipAdapterStatus,
): T {
  const { agent, project, company } = state;
  return {
    ...context,
    projectId: context.projectId ?? project?.project_id ?? null,
    companyId: context.companyId ?? company?.company_id ?? null,
    lifecycleState: context.lifecycleState ?? project?.lifecycle_state ?? project?.status ?? null,
    roles: context.roles?.length ? context.roles : Array.isArray(agent?.roles) ? agent.roles : [],
    capabilities: context.capabilities?.length ? context.capabilities : Array.isArray(agent?.capabilities) ? agent.capabilities : [],
    paperclipSource: status.source,
    paperclipSourceOfTruth: status.sourceOfTruth,
    paperclipDegraded: status.degraded,
    paperclipError: status.lastError,
  };
}

/**
 * Paperclip adapter backed by a pluggable Paperclip client.
 *
 * Current behavior:
 * - registry-backed stand-in client by default
 * - explicit source-of-truth policy controls whether fallback is allowed
 * - lightweight in-memory resolved-state caching
 * - enrichment provenance is exposed on resolved context
 */
export class DefaultPaperclipAdapter {
  private readonly primaryClient: PaperclipClient;
  private readonly fallbackClient: PaperclipClient | null;
  private readonly cacheTtlMs: number;
  private readonly sourceOfTruth: "registry-only" | "api-preferred" | "api-only";
  private cache: CachedStateEntry | null = null;
  private lastStatus: PaperclipAdapterStatus = {
    source: null,
    degraded: false,
    lastError: null,
    cacheHit: false,
    sourceOfTruth: "registry-only",
  };

  constructor(private readonly options: PaperclipAdapterOptions = {}) {
    this.sourceOfTruth = options.sourceOfTruth
      ?? (options.mode === "api" ? "api-preferred" : "registry-only");

    if (this.sourceOfTruth === "registry-only") {
      this.primaryClient = options.client ?? new RegistryPaperclipClient();
      this.fallbackClient = null;
    } else {
      this.primaryClient = options.client ?? selectApiClient(options);
      this.fallbackClient = this.sourceOfTruth === "api-preferred" && options.fallbackToRegistryOnError !== false
        ? new RegistryPaperclipClient()
        : null;
    }

    this.cacheTtlMs = options.cacheTtlMs ?? 30000;
    this.lastStatus.sourceOfTruth = this.sourceOfTruth;
  }

  status(): PaperclipAdapterStatus {
    return this.lastStatus;
  }

  private async resolveWithPolicy(context: ResolvedContext): Promise<{ state: PaperclipResolvedState; status: PaperclipAdapterStatus; cacheable: boolean }> {
    try {
      const state = await this.primaryClient.resolveState(context);
      const source: PaperclipAdapterStatus["source"] = this.sourceOfTruth === "registry-only" ? "registry" : "api";
      return {
        state,
        status: {
          source,
          degraded: false,
          lastError: null,
          cacheHit: false,
          sourceOfTruth: this.sourceOfTruth,
        },
        cacheable: true,
      };
    } catch (err: any) {
      if (!this.fallbackClient) {
        return {
          state: {
            agent: null,
            project: null,
            company: null,
          },
          status: {
            source: this.sourceOfTruth === "api-only" ? "api" : null,
            degraded: true,
            lastError: err?.message || String(err),
            cacheHit: false,
            sourceOfTruth: this.sourceOfTruth,
          },
          cacheable: false,
        };
      }
      const fallbackState = await this.fallbackClient.resolveState(context);
      return {
        state: fallbackState,
        status: {
          source: "registry-fallback",
          degraded: true,
          lastError: err?.message || String(err),
          cacheHit: false,
          sourceOfTruth: this.sourceOfTruth,
        },
        cacheable: true,
      };
    }
  }

  async enrichContext<T extends ResolvedContext>(context: T): Promise<T> {
    const key = makeCacheKey(context);
    const now = Date.now();
    if (this.cache && this.cache.key === key && now - this.cache.storedAt < this.cacheTtlMs) {
      this.lastStatus = {
        ...this.lastStatus,
        source: "cache",
        cacheHit: true,
      };
      return enrichFromState(context, this.cache.state, this.lastStatus);
    }

    const resolved = await this.resolveWithPolicy(context);
    if (resolved.cacheable) {
      this.cache = { key, storedAt: now, state: resolved.state };
    }
    this.lastStatus = resolved.status;
    return enrichFromState(context, resolved.state, this.lastStatus);
  }
}
