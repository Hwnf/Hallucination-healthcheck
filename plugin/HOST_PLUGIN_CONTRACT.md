# Host Plugin Contract

This document describes the current host-facing contract for the Blueprint v2 memory runtime plugin.

## Purpose
The goal is to make the plugin boundary explicit and host-native:
- host event envelope in
- adapter mapping
- runtime execution
- standardized host response envelope out
- explicit protocol/capability metadata for host negotiation

This contract is implemented in:
- `plugin/runtime/host-events.ts`
- `plugin/runtime/host-lifecycle.ts`
- `plugin/runtime/host-plugin.ts`
- `plugin/runtime/plugin-entry.ts`
- `plugin/runtime/host-registry.ts`
- `plugin/integrations/openclaw-adapter.ts`

---

## 1. Registration Shape
Hosts create a registration-ready descriptor with:

```ts
import { createHostPluginDescriptor } from "./runtime/plugin-entry";

const plugin = createHostPluginDescriptor({
  hostPlugin: {
    id: "blueprint-v2-memory-runtime",
    displayName: "Blueprint V2 Memory Runtime",
    version: "0.1.0",
  },
});
```

The descriptor includes:
- `id`
- `displayName`
- `version`
- `capabilities`
- `runtime`
- `execute`
- `hooks`

`runtime` is the composed internal runtime surface.
`execute` is the host-facing lifecycle executor.
`hooks` declares the input/output contract for each lifecycle hook.
`capabilities` gives the host an explicit protocol/capability negotiation surface.

---

## 2. Capability / Negotiation Metadata
The descriptor now exposes capability metadata:

```ts
capabilities: {
  protocolVersion: "host-plugin.v1",
  supportedHooks: ["preTurn", "postTurn", "health"],
  responseEnvelopes: ["HostPreTurnResponse", "HostPostTurnResponse", "HostHealthResponse"],
  features: [
    "host-event-envelopes",
    "host-response-envelopes",
    "host-error-envelopes",
    "paperclip-provenance",
    "registry-health"
  ]
}
```

This is currently lightweight metadata, not a full negotiated handshake protocol.
But it gives the host a real way to inspect what the plugin says it supports.

---

## 3. Host Event Envelopes
Defined in `plugin/runtime/host-events.ts`.

### Base envelope
```ts
interface HostEventEnvelope {
  eventId?: string;
  source?: string;
  receivedAt?: string;
  runtimeInput: unknown;
}
```

### Pre-turn
```ts
interface HostPreTurnEvent extends HostEventEnvelope {
  hook: "preTurn";
  query: string;
  intent: RetrievalIntent;
}
```

### Post-turn
```ts
interface HostPostTurnEvent extends HostEventEnvelope {
  hook: "postTurn";
  candidate: WriteCandidate;
}
```

### Health
```ts
interface HostHealthEvent extends HostEventEnvelope {
  hook: "health";
}
```

---

## 4. Host Response Envelopes
Also defined in `plugin/runtime/host-events.ts`.

### Base response
```ts
interface HostResponseEnvelope<TPayload> {
  pluginId: string;
  hook: "preTurn" | "postTurn" | "health";
  eventId?: string;
  emittedAt: string;
  ok: boolean;
  payload: TPayload;
  provenance?: HostEnvelopeProvenance;
}
```

### Provenance block
```ts
interface HostEnvelopeProvenance {
  paperclip?: {
    source: string | null;
    degraded: boolean;
    error: string | null;
  };
}
```

### Specialized responses
- `HostPreTurnResponse = HostResponseEnvelope<PreTurnOutput | HostErrorPayload>`
- `HostPostTurnResponse = HostResponseEnvelope<PostTurnOutput | HostErrorPayload>`
- `HostHealthResponse = HostResponseEnvelope<RegistryHealth | HostErrorPayload>`

### Error payloads
Runtime failures thrown from lifecycle execution are wrapped into:

```ts
interface HostErrorPayload {
  code: string;
  message: string;
}
```

Current hook-level error codes:
- `HOST_PRETURN_ERROR`
- `HOST_POSTTURN_ERROR`
- `HOST_HEALTH_ERROR`

Current classification behavior:
- transient/failure-style messages may be marked `retryable: true`
- severity is currently inferred heuristically (`warning` / `error` / `fatal`)

---

## 5. Adapter Boundary
`plugin/integrations/openclaw-adapter.ts` performs host-envelope normalization into internal hook inputs.

### Mapping helpers
- `hostPreTurnToHookInput(event)`
- `hostPostTurnToHookInput(event)`

This keeps host envelope structure separate from internal hook input shape.

---

## 6. Lifecycle Execution Surface
`plugin/runtime/host-lifecycle.ts` exposes:
- `handlePreTurnEvent(event)`
- `handlePostTurnEvent(event)`
- `handleHealthEvent(event?)`

These methods:
1. accept host event envelopes
2. map them through the OpenClaw adapter
3. call the composed runtime
4. return standardized host response envelopes
5. lift available Paperclip provenance to top-level response metadata

---

## 7. Descriptor Hook Contract
The registration descriptor currently declares:

### `preTurn`
- input: `HostPreTurnEvent`
- output: `HostPreTurnResponse`

### `postTurn`
- input: `HostPostTurnEvent`
- output: `HostPostTurnResponse`

### `health`
- input: `HostHealthEvent`
- output: `HostHealthResponse`

---

## 8. Current Execution Flow
### Pre-turn
1. Host sends `HostPreTurnEvent`
2. Descriptor `execute.handlePreTurnEvent()` receives it
3. OpenClaw adapter maps it to internal `PreTurnInput`
4. Runtime resolves context, routes scopes, enforces ACL, retrieves memory, and returns `PreTurnOutput`
5. Executor wraps that into `HostPreTurnResponse`
6. Executor lifts available Paperclip provenance to top-level `response.provenance`

### Post-turn
1. Host sends `HostPostTurnEvent`
2. Descriptor `execute.handlePostTurnEvent()` receives it
3. OpenClaw adapter maps it to internal `PostTurnInput`
4. Runtime validates write intent, enforces lifecycle and ACL, writes memory if allowed, and returns `PostTurnOutput`
5. Executor wraps that into `HostPostTurnResponse`
6. Executor lifts available Paperclip provenance to top-level `response.provenance`

### Health
1. Host sends `HostHealthEvent`
2. Descriptor `execute.handleHealthEvent()` receives it
3. Runtime loads registry health state
4. Executor wraps `RegistryHealth` into `HostHealthResponse`

---

## 9. Current Guarantees
The current contract guarantees:
- explicit host input envelopes
- explicit host output envelopes
- optional chunked pre-turn host response surface for retrieval-heavy contexts
- plugin identity in responses
- event correlation via `eventId`
- lifecycle hook naming stability
- adapter separation between host envelope and internal hook input
- registry health availability as a host-facing lifecycle operation
- top-level Paperclip provenance visibility when runtime payloads provide it
- descriptor-level capability metadata for host inspection

---

## 10. Current Limits
This contract is still a serious scaffold, not a final production plugin API.

Still lightweight:
- no host authentication/authorization layer in the contract itself
- no retry/ack protocol
- no streaming response contract
- no negotiated downgrade/upgrade behavior across protocol versions
- no async job/offload lifecycle for long-running operations
- capability metadata is declarative, not yet enforced by a true negotiation handshake

---

## 11. Negotiation Mismatch Behavior
Current behavior:
- host expectation mismatch can now be evaluated explicitly through a negotiation helper
- mismatch returns a structured result with:
  - `ok`
  - `reason`
  - `protocolMismatch`
  - missing hooks/features/response envelopes
- host entry can now choose policy mode:
  - `advisory` → keep descriptor creation alive and inspect mismatch separately
  - `enforce` → throw and refuse descriptor creation when expectations are not met

## 12. Host Registration State Persistence
The host registry is no longer memory-only.

Current implementation in `plugin/runtime/host-registry.ts` supports:
- `exportSnapshot()`
- `importSnapshot(snapshot)`
- `saveToFile(path)`
- `loadFromFile(path)`
- `HostPluginRegistry.fromFile(path)`

Snapshot shape:
```ts
interface HostRegistrySnapshot {
  schemaVersion: "host-plugin-registry.v1";
  exportedAt: string;
  records: HostPluginRecord[];
}
```

This makes it possible for a host to:
- persist registered/degraded/rejected/disabled plugin state across restarts
- preserve negotiation and last-health metadata
- restore execution policy context without rediscovering everything from scratch

Current smoke coverage:
- `plugin/tests/host-registry-persistence-smoke.ts`

## 13. Recommended Next Contract Work
The strongest next contract-level improvements are:
1. decide whether structured retryability / severity should be part of host error payloads
2. decide whether chunked pre-turn should evolve into a true streaming transport contract
3. define actual OpenClaw core plugin discovery/loading mechanics
4. decide whether negotiation mismatch should become a hard registration failure in some host modes

---

## One-line summary
The Blueprint v2 runtime now exposes a real host/plugin lifecycle contract: registration descriptor, explicit capability metadata, host event envelopes, lifecycle execution helpers, standardized host response envelopes, top-level provenance signaling, and negotiation-aware loading expectations.
