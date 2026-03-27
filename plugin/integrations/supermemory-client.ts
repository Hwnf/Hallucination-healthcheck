import type { SupermemoryClient } from "../interfaces";
import type { MemoryRecordV2 } from "../types/memory";
import type { RetrievalCandidate, RetrievalRequest } from "../types/retrieval";

export interface SupermemoryClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultThreshold?: number;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requireApiKey(value?: string): string {
  if (!value) {
    throw new Error("Missing Supermemory API key. Set SUPERMEMORY_API_KEY.");
  }
  return value;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? env("SUPERMEMORY_BASE_URL") ?? "https://api.supermemory.ai").replace(/\/$/, "");
}

function readMeta<T = unknown>(meta: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (meta[key] !== undefined) return meta[key] as T;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function normalizeScope(value: unknown): MemoryRecordV2["memoryScope"] {
  const v = String(value ?? "project");
  const allowed = new Set([
    "governance",
    "company",
    "project",
    "restricted_shared",
    "agent_private",
    "experience",
    "user",
    "session",
    "cold_storage",
    "ephemeral",
  ]);
  return (allowed.has(v) ? v : "project") as MemoryRecordV2["memoryScope"];
}

function normalizeVisibility(value: unknown): MemoryRecordV2["visibility"] {
  const v = String(value ?? "shared");
  const allowed = new Set([
    "shared",
    "restricted",
    "private",
    "orchestrator_only",
    "operator_only",
    "manager_operator_only",
  ]);
  return (allowed.has(v) ? v : "shared") as MemoryRecordV2["visibility"];
}

function normalizeStatus(value: unknown): MemoryRecordV2["status"] {
  const v = String(value ?? "active");
  const allowed = new Set([
    "proposed",
    "approved",
    "active",
    "archived",
    "stale",
    "rejected",
    "superseded",
    "disputed",
    "resolved",
  ]);
  return (allowed.has(v) ? v : "active") as MemoryRecordV2["status"];
}

function makeContainerTag(request: RetrievalRequest): string | undefined {
  const c = request.context;
  if (c.projectId) return c.projectId;
  if (c.userId) return `user_${c.userId}`;
  if (c.companyId) return c.companyId;
  return undefined;
}

function makeSearchFilters(request: RetrievalRequest): Record<string, unknown> | undefined {
  const filters: any[] = [];

  const { context } = request;
  if (context.companyId) filters.push({ key: "companyId", value: String(context.companyId) });
  if (context.projectId) filters.push({ key: "projectId", value: String(context.projectId) });
  if (context.userId) filters.push({ key: "userId", value: String(context.userId) });
  if (context.conversationId) filters.push({ key: "conversationId", value: String(context.conversationId) });

  if (!request.includeArchived) filters.push({ key: "status", value: "archived", negate: true });
  if (!request.includeSuperseded) filters.push({ key: "status", value: "superseded", negate: true });

  return filters.length ? { OR: filters } : undefined;
}

function mapSearchItemToCandidate(item: any): RetrievalCandidate {
  const metadata = item.metadata ?? item.meta ?? {};
  const memoryText = item.memory ?? item.content ?? item.text ?? readMeta<string>(metadata, "content") ?? "";

  const record: MemoryRecordV2 = {
    schemaVersion: "2.0",
    memoryId: String(item.id ?? readMeta(metadata, "memoryId", "memory_id") ?? `mem_${Math.random().toString(36).slice(2, 10)}`),
    canonicalKey: asString(readMeta(metadata, "canonicalKey", "canonical_key")),
    memoryType: (asString(readMeta(metadata, "memoryType", "memory_type")) as any) ?? null,
    agentId: asString(readMeta(metadata, "agentId", "agent_id")),
    agentName: asString(readMeta(metadata, "agentName", "agent_name")),
    agentKind: asString(readMeta(metadata, "agentKind", "agent_kind")),
    companyId: asString(readMeta(metadata, "companyId", "company_id")),
    projectId: asString(readMeta(metadata, "projectId", "project_id")),
    userId: asString(readMeta(metadata, "userId", "user_id")),
    conversationId: asString(readMeta(metadata, "conversationId", "conversation_id")),
    memoryScope: normalizeScope(readMeta(metadata, "memoryScope", "memory_scope")),
    visibility: normalizeVisibility(readMeta(metadata, "visibility")),
    sensitivity: (asString(readMeta(metadata, "sensitivity")) as any) ?? "internal",
    writtenBy: asString(readMeta(metadata, "writtenBy", "written_by")),
    approvedBy: asString(readMeta(metadata, "approvedBy", "approved_by")),
    promotedFrom: (asString(readMeta(metadata, "promotedFrom", "promoted_from")) as any) ?? null,
    promotionState: (asString(readMeta(metadata, "promotionState", "promotion_state")) as any) ?? "none",
    promotionReason: asString(readMeta(metadata, "promotionReason", "promotion_reason")),
    status: normalizeStatus(readMeta(metadata, "status")),
    verificationState: (asString(readMeta(metadata, "verificationState", "verification_state")) as any) ?? null,
    confidence: asNumber(readMeta(metadata, "confidence")),
    importance: asString(readMeta(metadata, "importance")),
    retention: (asString(readMeta(metadata, "retention")) as any) ?? null,
    sourceType: asString(readMeta(metadata, "sourceType", "source_type")),
    sourceRef: asString(readMeta(metadata, "sourceRef", "source_ref")),
    derivedFrom: asStringArray(readMeta(metadata, "derivedFrom", "derived_from")),
    contradictionSet: asString(readMeta(metadata, "contradictionSet", "contradiction_set")),
    supersedes: asStringArray(readMeta(metadata, "supersedes")),
    supersededBy: asString(readMeta(metadata, "supersededBy", "superseded_by")),
    effectiveFrom: asString(readMeta(metadata, "effectiveFrom", "effective_from")),
    effectiveUntil: asString(readMeta(metadata, "effectiveUntil", "effective_until")),
    ttl: asString(readMeta(metadata, "ttl")),
    expiresAt: asString(readMeta(metadata, "expiresAt", "expires_at")),
    lastValidatedAt: asString(readMeta(metadata, "lastValidatedAt", "last_validated_at")),
    retrievalPriority: asNumber(readMeta(metadata, "retrievalPriority", "retrieval_priority")),
    qualityScore: asNumber(readMeta(metadata, "qualityScore", "quality_score")),
    dedupKey: asString(readMeta(metadata, "dedupKey", "dedup_key")),
    tags: asStringArray(readMeta(metadata, "tags")),
    timestamp: String(readMeta(metadata, "timestamp") ?? item.createdAt ?? new Date().toISOString()),
    content: String(memoryText),
    summary: asString(readMeta(metadata, "summary")),
  };

  return {
    record,
    semanticScore: typeof item.score === "number" ? item.score : undefined,
    finalScore: typeof item.score === "number" ? item.score : undefined,
  };
}

/**
 * Supermemory client using the documented public API:
 * - POST /v4/search
 * - POST /v4/memories
 * - POST /v4/conversations
 *
 * Mapper policy:
 * - trust backend for storage/search
 * - normalize metadata shape aggressively in the client
 * - keep Blueprint v2 as canon even if backend field shapes vary
 */
export class DefaultSupermemoryClient implements SupermemoryClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultThreshold: number;

  constructor(options: SupermemoryClientOptions = {}) {
    this.apiKey = requireApiKey(options.apiKey ?? env("SUPERMEMORY_API_KEY"));
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.defaultThreshold = options.defaultThreshold ?? Number(env("SUPERMEMORY_DEFAULT_THRESHOLD") ?? 0.6);
  }

  async search(request: RetrievalRequest): Promise<RetrievalCandidate[]> {
    const body: Record<string, unknown> = {
      query: request.query,
      threshold: this.defaultThreshold,
    };

    const containerTag = makeContainerTag(request);
    if (containerTag) body.containerTag = containerTag;

    const filters = makeSearchFilters(request);
    if (filters) body.filters = filters;

    const res = await fetch(`${this.baseUrl}/v4/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supermemory search failed (${res.status}): ${text}`);
    }

    const json: any = await res.json();
    const items = Array.isArray(json?.results)
      ? json.results
      : Array.isArray(json?.memories)
        ? json.memories
        : Array.isArray(json)
          ? json
          : [];

    return items.map(mapSearchItemToCandidate);
  }

  async write(record: MemoryRecordV2): Promise<{ memoryId: string }> {
    const containerTag = this.resolveWriteContainer(record);

    const body = {
      containerTag,
      memories: [
        {
          content: record.content,
          isStatic: record.memoryScope === "user" || record.memoryScope === "governance" || record.memoryScope === "company",
          metadata: {
            schemaVersion: record.schemaVersion,
            memoryId: record.memoryId,
            canonicalKey: record.canonicalKey,
            memoryType: record.memoryType,
            agentId: record.agentId,
            agentName: record.agentName,
            agentKind: record.agentKind,
            companyId: record.companyId,
            projectId: record.projectId,
            userId: record.userId,
            conversationId: record.conversationId,
            memoryScope: record.memoryScope,
            visibility: record.visibility,
            sensitivity: record.sensitivity,
            writtenBy: record.writtenBy,
            approvedBy: record.approvedBy,
            promotedFrom: record.promotedFrom,
            promotionState: record.promotionState,
            promotionReason: record.promotionReason,
            status: record.status,
            verificationState: record.verificationState,
            confidence: record.confidence,
            importance: record.importance,
            retention: record.retention,
            sourceType: record.sourceType,
            sourceRef: record.sourceRef,
            derivedFrom: record.derivedFrom,
            contradictionSet: record.contradictionSet,
            supersedes: record.supersedes,
            supersededBy: record.supersededBy,
            effectiveFrom: record.effectiveFrom,
            effectiveUntil: record.effectiveUntil,
            ttl: record.ttl,
            expiresAt: record.expiresAt,
            lastValidatedAt: record.lastValidatedAt,
            retrievalPriority: record.retrievalPriority,
            qualityScore: record.qualityScore,
            dedupKey: record.dedupKey,
            tags: record.tags,
            timestamp: record.timestamp,
            summary: record.summary,
          },
        },
      ],
    };

    const res = await fetch(`${this.baseUrl}/v4/memories`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supermemory write failed (${res.status}): ${text}`);
    }

    const json: any = await res.json();
    const id = json?.memories?.[0]?.id ?? json?.id ?? record.memoryId;
    return { memoryId: String(id) };
  }

  async ingestConversation(conversationId: string, messages: ConversationMessage[], metadata?: Record<string, string | number | boolean>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v4/conversations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        conversationId,
        messages,
        metadata,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supermemory conversation ingest failed (${res.status}): ${text}`);
    }
  }

  private resolveWriteContainer(record: MemoryRecordV2): string {
    if (record.memoryScope === "project" && record.projectId) return record.projectId;
    if (record.memoryScope === "company" && record.companyId) return record.companyId;
    if (record.memoryScope === "user" && record.userId) return `user_${record.userId}`;
    if (record.memoryScope === "agent_private" && record.agentId) return `agent_${record.agentId}_private`;
    if (record.memoryScope === "cold_storage" && record.projectId) {
      const normalized = record.projectId.startsWith("project_") ? record.projectId.slice("project_".length) : record.projectId;
      return `archive_project_${normalized}`;
    }
    if (record.memoryScope === "governance") return "gov_global";
    if (record.companyId) return record.companyId;
    if (record.projectId) return record.projectId;
    if (record.userId) return `user_${record.userId}`;
    return "default";
  }

  private headers(): HeadersInit {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }
}
