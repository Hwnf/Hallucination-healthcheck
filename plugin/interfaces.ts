import type { PermissionAction, AclDecision } from "./types/acl";
import type { PluginConfig } from "./types/config";
import type { ResolvedContext } from "./types/context";
import type { WriteCandidate, PromotionCandidate, PromotionResult, CloseoutResult } from "./types/lifecycle";
import type { MemoryRecordV2 } from "./types/memory";
import type { RetrievalIntent, RetrievalRequest, RetrievalCandidate, RetrievalResult, ScopeRoute } from "./types/retrieval";
import type { PreTurnInput, PreTurnOutput } from "./runtime/hook-pre-turn";
import type { PostTurnInput, PostTurnOutput } from "./runtime/hook-post-turn";

export interface ContextResolver {
  resolve(input: unknown): Promise<ResolvedContext>;
}

export interface AclEngine {
  can(context: ResolvedContext, action: PermissionAction, resourceId: string): Promise<AclDecision>;
}

export interface ScopeRouter {
  route(context: ResolvedContext, intent: RetrievalIntent): Promise<ScopeRoute>;
}

export interface RetrievalGate {
  filter(request: RetrievalRequest, candidates: RetrievalCandidate[]): Promise<RetrievalResult>;
}

export interface MetadataBuilder {
  build(candidate: WriteCandidate, context: ResolvedContext): Promise<MemoryRecordV2>;
}

export interface PromotionManager {
  propose(candidate: PromotionCandidate): Promise<PromotionResult>;
}

export interface PromotionBackendWriter {
  write(record: MemoryRecordV2): Promise<{ memoryId: string }>;
}

export interface CloseoutManager {
  closeProject(projectId: string, context: ResolvedContext): Promise<CloseoutResult>;
}

export interface SupermemoryClient {
  search(request: RetrievalRequest): Promise<RetrievalCandidate[]>;
  write(record: MemoryRecordV2): Promise<{ memoryId: string }>;
}

export interface PluginRuntime {
  config: PluginConfig;
  preTurn(input: PreTurnInput): Promise<PreTurnOutput>;
  postTurn(input: PostTurnInput): Promise<PostTurnOutput>;
  health(): Promise<{
    ok: boolean;
    issues: Array<{ registry: string; path: string; severity: "warning" | "error"; message: string }>;
    loadedAt: string;
  }>;
}

export interface HostPluginCapabilities {
  protocolVersion: string;
  supportedHooks: Array<"preTurn" | "postTurn" | "health">;
  responseEnvelopes: Array<"HostPreTurnResponse" | "HostPostTurnResponse" | "HostHealthResponse" | "HostPreTurnChunkResponse">;
  features: string[];
}

export interface HostPluginDescriptor {
  id: string;
  displayName: string;
  version: string;
  capabilities: HostPluginCapabilities;
  runtime: PluginRuntime;
  execute: {
    handlePreTurnEvent(event: unknown): Promise<unknown>;
    handlePreTurnEventChunked(event: unknown): Promise<unknown>;
    handlePostTurnEvent(event: unknown): Promise<unknown>;
    handleHealthEvent(event?: unknown): Promise<unknown>;
  };
  hooks: {
    preTurn: {
      name: "preTurn";
      description: string;
      inputEnvelope: "HostPreTurnEvent";
      outputEnvelope: "HostPreTurnResponse";
    };
    postTurn: {
      name: "postTurn";
      description: string;
      inputEnvelope: "HostPostTurnEvent";
      outputEnvelope: "HostPostTurnResponse";
    };
    health: {
      name: "health";
      description: string;
      inputEnvelope: "HostHealthEvent";
      outputEnvelope: "HostHealthResponse";
    };
  };
}
