import type { HostPluginDescriptor, PluginRuntime } from "../interfaces";
import { HostLifecycleExecutor } from "./host-lifecycle";

export interface HostPluginOptions {
  id?: string;
  displayName?: string;
  version?: string;
}

export function createHostPlugin(runtime: PluginRuntime, options: HostPluginOptions = {}): HostPluginDescriptor {
  const pluginId = options.id ?? "blueprint-v2-memory-runtime";
  const executor = new HostLifecycleExecutor(pluginId, runtime);

  return {
    id: pluginId,
    displayName: options.displayName ?? "Blueprint V2 Memory Runtime",
    version: options.version ?? "0.1.0",
    capabilities: {
      protocolVersion: "host-plugin.v1",
      supportedHooks: ["preTurn", "postTurn", "health"],
      responseEnvelopes: ["HostPreTurnResponse", "HostPostTurnResponse", "HostHealthResponse", "HostPreTurnChunkResponse"],
      features: [
        "host-event-envelopes",
        "host-response-envelopes",
        "host-error-envelopes",
        "paperclip-provenance",
        "registry-health",
        "chunked-preturn-response",
      ],
    },
    runtime,
    execute: {
      handlePreTurnEvent: (event) => executor.handlePreTurnEvent(event as any),
      handlePostTurnEvent: (event) => executor.handlePostTurnEvent(event as any),
      handleHealthEvent: (event) => executor.handleHealthEvent(event as any),
      handlePreTurnEventChunked: (event) => executor.handlePreTurnEventChunked(event as any),
    } as any,
    hooks: {
      preTurn: {
        name: "preTurn",
        description: "Resolve context, route retrieval scopes, enforce ACL, and return pre-turn context block.",
        inputEnvelope: "HostPreTurnEvent",
        outputEnvelope: "HostPreTurnResponse",
      },
      postTurn: {
        name: "postTurn",
        description: "Validate writes, enforce lifecycle/ACL policy, build metadata, and persist memory records.",
        inputEnvelope: "HostPostTurnEvent",
        outputEnvelope: "HostPostTurnResponse",
      },
      health: {
        name: "health",
        description: "Return registry/control-plane health for host observability and fail-safe handling.",
        inputEnvelope: "HostHealthEvent",
        outputEnvelope: "HostHealthResponse",
      },
    },
  };
}
