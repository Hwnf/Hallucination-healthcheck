import type { PluginRuntime } from "../interfaces";
import type {
  HostHealthEvent,
  HostHealthResponse,
  HostPostTurnEvent,
  HostPostTurnResponse,
  HostPreTurnEvent,
  HostPreTurnResponse,
  HostEnvelopeProvenance,
  HostPreTurnChunkResponse,
  HostStreamingChunk,
  HostErrorPayload,
} from "./host-events";
import { DefaultOpenClawAdapter } from "../integrations/openclaw-adapter";

function errorCodeForHook(hook: "preTurn" | "postTurn" | "health"): string {
  switch (hook) {
    case "preTurn":
      return "HOST_PRETURN_ERROR";
    case "postTurn":
      return "HOST_POSTTURN_ERROR";
    case "health":
      return "HOST_HEALTH_ERROR";
  }
}

function errorPayloadForHook(hook: "preTurn" | "postTurn" | "health", err: any): HostErrorPayload {
  const message = err?.message || String(err);
  const lower = message.toLowerCase();
  const retryable = lower.includes("timeout") || lower.includes("tempor") || lower.includes("unavailable") || lower.includes("failed");
  const severity: HostErrorPayload["severity"] = lower.includes("fatal") ? "fatal" : retryable ? "error" : "warning";

  return {
    code: errorCodeForHook(hook),
    message,
    severity,
    retryable,
  };
}

function provenanceFromPayload(payload: any): HostEnvelopeProvenance | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  if (!payload.paperclip) return undefined;
  return {
    paperclip: {
      source: payload.paperclip.source ?? null,
      degraded: payload.paperclip.degraded ?? false,
      error: payload.paperclip.error ?? null,
    },
  };
}

function chunkText(text: string, maxChars = 160): HostStreamingChunk[] {
  const lines = text ? text.split("\n") : [];
  if (!lines.length) return [{ index: 0, total: 1, content: "" }];

  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((content, index) => ({
    index,
    total: chunks.length,
    content,
  }));
}

export class HostLifecycleExecutor {
  constructor(
    private readonly pluginId: string,
    private readonly runtime: PluginRuntime,
    private readonly adapter = new DefaultOpenClawAdapter(),
  ) {}

  async handlePreTurnEvent(event: HostPreTurnEvent): Promise<HostPreTurnResponse> {
    try {
      const payload = await this.runtime.preTurn(this.adapter.hostPreTurnToHookInput(event));
      return {
        pluginId: this.pluginId,
        hook: "preTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: true,
        payload,
        provenance: provenanceFromPayload(payload),
      };
    } catch (err: any) {
      return {
        pluginId: this.pluginId,
        hook: "preTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: false,
        payload: errorPayloadForHook("preTurn", err),
      };
    }
  }

  async handlePreTurnEventChunked(event: HostPreTurnEvent): Promise<HostPreTurnChunkResponse> {
    try {
      const final = await this.runtime.preTurn(this.adapter.hostPreTurnToHookInput(event));
      const chunks = chunkText(final.contextBlock);
      return {
        pluginId: this.pluginId,
        hook: "preTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: true,
        payload: {
          chunks,
          final,
        },
        provenance: provenanceFromPayload(final),
      };
    } catch (err: any) {
      return {
        pluginId: this.pluginId,
        hook: "preTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: false,
        payload: errorPayloadForHook("preTurn", err),
      };
    }
  }

  async handlePostTurnEvent(event: HostPostTurnEvent): Promise<HostPostTurnResponse> {
    try {
      const payload = await this.runtime.postTurn(this.adapter.hostPostTurnToHookInput(event));
      return {
        pluginId: this.pluginId,
        hook: "postTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: true,
        payload,
        provenance: provenanceFromPayload(payload),
      };
    } catch (err: any) {
      return {
        pluginId: this.pluginId,
        hook: "postTurn",
        eventId: event.eventId,
        emittedAt: new Date().toISOString(),
        ok: false,
        payload: errorPayloadForHook("postTurn", err),
      };
    }
  }

  async handleHealthEvent(event?: HostHealthEvent): Promise<HostHealthResponse> {
    try {
      const payload = await this.runtime.health();
      return {
        pluginId: this.pluginId,
        hook: "health",
        eventId: event?.eventId,
        emittedAt: new Date().toISOString(),
        ok: payload.ok,
        payload,
      };
    } catch (err: any) {
      return {
        pluginId: this.pluginId,
        hook: "health",
        eventId: event?.eventId,
        emittedAt: new Date().toISOString(),
        ok: false,
        payload: errorPayloadForHook("health", err),
      };
    }
  }
}
