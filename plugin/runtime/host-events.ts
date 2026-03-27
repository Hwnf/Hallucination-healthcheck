import type { RetrievalIntent } from "../types/retrieval";
import type { WriteCandidate } from "../types/lifecycle";
import type { PreTurnOutput } from "./hook-pre-turn";
import type { PostTurnOutput } from "./hook-post-turn";
import type { RegistryHealth } from "../registries/registry-health";

export interface HostEventEnvelope {
  eventId?: string;
  source?: string;
  receivedAt?: string;
  runtimeInput: unknown;
}

export interface HostPreTurnEvent extends HostEventEnvelope {
  hook: "preTurn";
  query: string;
  intent: RetrievalIntent;
}

export interface HostPostTurnEvent extends HostEventEnvelope {
  hook: "postTurn";
  candidate: WriteCandidate;
}

export interface HostHealthEvent extends HostEventEnvelope {
  hook: "health";
}

export interface HostEnvelopeProvenance {
  paperclip?: {
    source: string | null;
    degraded: boolean;
    error: string | null;
  };
}

export interface HostStreamingChunk {
  index: number;
  total: number;
  content: string;
}

export interface HostResponseEnvelope<TPayload> {
  pluginId: string;
  hook: "preTurn" | "postTurn" | "health";
  eventId?: string;
  emittedAt: string;
  ok: boolean;
  payload: TPayload;
  provenance?: HostEnvelopeProvenance;
}

export interface HostErrorPayload {
  code: string;
  message: string;
  severity: "warning" | "error" | "fatal";
  retryable: boolean;
}

export type HostPreTurnResponse = HostResponseEnvelope<PreTurnOutput | HostErrorPayload>;
export type HostPostTurnResponse = HostResponseEnvelope<PostTurnOutput | HostErrorPayload>;
export type HostHealthResponse = HostResponseEnvelope<RegistryHealth | HostErrorPayload>;
export type HostPreTurnChunkResponse = HostResponseEnvelope<{
  chunks: HostStreamingChunk[];
  final: PreTurnOutput;
} | HostErrorPayload>;
