import { HostExecutionController } from "../runtime/host-controller";
import type { HostPluginRecord } from "../runtime/host-registry";
import type { HostPluginDescriptor } from "../interfaces";

async function main() {
  const descriptor: HostPluginDescriptor = {
    id: "override-plugin",
    displayName: "Override Plugin",
    version: "0.8.0-test",
    capabilities: {
      protocolVersion: "host-plugin.v1",
      supportedHooks: ["preTurn", "postTurn", "health"],
      responseEnvelopes: ["HostPreTurnResponse", "HostPostTurnResponse", "HostHealthResponse", "HostPreTurnChunkResponse"],
      features: ["host-event-envelopes", "host-response-envelopes"],
    },
    runtime: {
      config: {} as any,
      async preTurn() {
        return {
          contextBlock: "ok",
          selectedCount: 0,
          allowedScopes: [],
        };
      },
      async postTurn() {
        return {
          wrote: true,
          memoryId: "mem_override",
          reason: "post allowed by fake runtime",
        };
      },
      async health() {
        return {
          ok: true,
          issues: [],
          loadedAt: new Date().toISOString(),
        };
      },
    },
    execute: {
      async handlePreTurnEvent(event: any) {
        return {
          pluginId: "override-plugin",
          hook: "preTurn",
          eventId: event.eventId,
          emittedAt: new Date().toISOString(),
          ok: true,
          payload: {
            contextBlock: "ok",
            selectedCount: 0,
            allowedScopes: [],
          },
        };
      },
      async handlePreTurnEventChunked(event: any) {
        return {
          pluginId: "override-plugin",
          hook: "preTurn",
          eventId: event.eventId,
          emittedAt: new Date().toISOString(),
          ok: true,
          payload: {
            chunks: [{ index: 0, total: 1, content: "ok" }],
            final: {
              contextBlock: "ok",
              selectedCount: 0,
              allowedScopes: [],
            },
          },
        };
      },
      async handlePostTurnEvent(event: any) {
        return {
          pluginId: "override-plugin",
          hook: "postTurn",
          eventId: event.eventId,
          emittedAt: new Date().toISOString(),
          ok: true,
          payload: {
            wrote: true,
            memoryId: "mem_override",
            reason: "post allowed by fake runtime",
          },
        };
      },
      async handleHealthEvent(event: any) {
        return {
          pluginId: "override-plugin",
          hook: "health",
          eventId: event?.eventId,
          emittedAt: new Date().toISOString(),
          ok: true,
          payload: {
            ok: true,
            issues: [],
            loadedAt: new Date().toISOString(),
          },
        };
      },
    },
    hooks: {
      preTurn: {
        name: "preTurn",
        description: "pre",
        inputEnvelope: "HostPreTurnEvent",
        outputEnvelope: "HostPreTurnResponse",
      },
      postTurn: {
        name: "postTurn",
        description: "post",
        inputEnvelope: "HostPostTurnEvent",
        outputEnvelope: "HostPostTurnResponse",
      },
      health: {
        name: "health",
        description: "health",
        inputEnvelope: "HostHealthEvent",
        outputEnvelope: "HostHealthResponse",
      },
    },
  };

  const degradedRecord: HostPluginRecord = {
    id: descriptor.id,
    version: descriptor.version,
    state: "degraded",
    manifest: {
      schemaVersion: "openclaw.plugin-manifest.v1",
      id: descriptor.id,
      displayName: descriptor.displayName,
      version: descriptor.version,
      entry: "plugin/runtime/plugin-entry.ts",
      factory: "createHostPluginDescriptor",
      protocolVersion: descriptor.capabilities.protocolVersion,
      capabilities: {
        supportedHooks: descriptor.capabilities.supportedHooks,
        responseEnvelopes: descriptor.capabilities.responseEnvelopes,
        features: descriptor.capabilities.features,
      },
    },
    capabilities: descriptor.capabilities,
    lastNegotiation: null,
    lastHealth: {
      ok: false,
      issues: [{ registry: "agents", path: "agents.json", severity: "error", message: "simulated degraded registry" }],
      loadedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  const strictController = new HostExecutionController(descriptor, degradedRecord, {
    overrides: {
      degraded: {
        preTurn: { allowed: false, reason: "strict host blocks preTurn when degraded" },
        postTurn: { allowed: false, reason: "strict host blocks postTurn when degraded" },
      },
    },
  });

  const lenientController = new HostExecutionController(descriptor, degradedRecord, {
    overrides: {
      degraded: {
        postTurn: { allowed: true, reason: "lenient host allows postTurn when degraded" },
      },
    },
  });

  const strictPre = await strictController.handlePreTurnEvent({
    hook: "preTurn",
    eventId: "evt_strict_pre",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
    query: "strict pre",
    intent: "active_project",
  });

  const lenientPost = await lenientController.handlePostTurnEvent({
    hook: "postTurn",
    eventId: "evt_lenient_post",
    source: "openclaw-host",
    receivedAt: new Date().toISOString(),
    runtimeInput: {},
    candidate: {
      targetScope: "governance",
      targetContainer: "gov_global",
      content: "lenient post",
      summary: "lenient post",
      confidence: 0.9,
    },
  });

  console.log(JSON.stringify({ strictPre, lenientPost }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
