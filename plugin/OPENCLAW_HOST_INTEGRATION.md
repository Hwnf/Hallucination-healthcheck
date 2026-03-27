# OpenClaw Host Integration Expectations

This document describes the current expected way an OpenClaw-like host should load and use the Blueprint v2 memory runtime.

## Goal
Move from:
- internal runtime + contract pieces

to:
- a practical host-side loading and execution expectation

This is not a claim that OpenClaw already loads this plugin natively in production.
It is the current integration target shape.

---

## 1. Host Loading Model
The host should treat the plugin as a registration-ready runtime module.

Expected entrypoint:
- manifest entry: `plugin/runtime/plugin-entry.ts`
- factory: `createHostPluginDescriptor(options)`

This returns a descriptor with:
- identity metadata
- capability metadata
- runtime handle
- execution helpers
- hook contract declarations

### Minimum host loading flow
1. load plugin module
2. call `createHostPluginDescriptor(...)`
3. inspect `descriptor.capabilities`
4. optionally apply negotiation expectations/policy
5. register the descriptor under `descriptor.id`
6. invoke lifecycle helpers through `descriptor.execute`

---

## 2. Suggested Host Registration Record
A host should minimally persist or track:

```ts
{
  id: descriptor.id,
  version: descriptor.version,
  protocolVersion: descriptor.capabilities.protocolVersion,
  hooks: descriptor.capabilities.supportedHooks,
  features: descriptor.capabilities.features,
}
```

A concrete example manifest is included at:
- `plugin/host-registration-manifest.example.json`

A programmatic manifest helper also exists:
- `createHostRegistrationManifest(descriptor)`

This gives the host enough metadata to:
- decide compatibility
- choose execution paths
- report plugin capability state to operators

---

## 3. Suggested Host Invocation Flow
### Pre-turn
Host sends:
- `HostPreTurnEvent`

Host invokes:
- `descriptor.execute.handlePreTurnEvent(event)`
or
- `descriptor.execute.handlePreTurnEventChunked(event)`

Host receives:
- `HostPreTurnResponse`
or
- `HostPreTurnChunkResponse`

### Post-turn
Host sends:
- `HostPostTurnEvent`

Host invokes:
- `descriptor.execute.handlePostTurnEvent(event)`

Host receives:
- `HostPostTurnResponse`

### Health
Host sends:
- `HostHealthEvent`

Host invokes:
- `descriptor.execute.handleHealthEvent(event)`

Host receives:
- `HostHealthResponse`

---

## 4. Suggested Host Policy Decisions
The host should decide:

### Negotiation mode
- `advisory`
- `enforce`

### Paperclip trust handling
How should the host react when response provenance says:
- `paperclip.source = api`
- `paperclip.source = registry-fallback`
- `paperclip.source = cache`
- `paperclip.degraded = true`

### Health handling
How should the host react when:
- registry health is degraded
- Paperclip provenance indicates fallback/degraded state
- negotiation mismatch exists but advisory mode allowed registration

---

## 5. Suggested Host Registration State
A host-side plugin registry should track at least:
- `id`
- `version`
- `state` (`discovered` | `registered` | `degraded` | `rejected` | `disabled`)
- manifest metadata
- capability metadata
- last negotiation result
- last health result
- `updatedAt`

This gives the host a minimal lifecycle/state record instead of treating plugin loading as stateless.

A host should also periodically reconcile registered plugins by reloading health and updating state (`registered` ↔ `degraded`, etc.) over time.
A host should also be able to explicitly disable and later re-enable a plugin without losing its record.
A host can now persist and restore this registry state through `HostPluginRegistry.saveToFile(...)`, `loadFromFile(...)`, and `exportSnapshot()` / `importSnapshot(...)`.

A host should apply an explicit action policy to lifecycle states. Recommended baseline:
- `registered`: allow `preTurn`, `postTurn`, `health`
- `degraded`: allow `preTurn`, `health`; block `postTurn`
- `rejected`: allow `health`; block execution hooks
- `disabled`: allow `health`; block execution hooks

This policy should be enforced by a host execution layer before invoking plugin hooks.
Current implementation path:
- `HostExecutionController`

A host may also apply explicit overrides if it wants stricter or looser behavior than the baseline matrix.
Example:
- strict host: block `preTurn` and `postTurn` when degraded
- lenient host: allow `postTurn` even when degraded

Current implementation path:
- `registerHostPluginFromManifest(...)` for initial load/state creation
- `reconcileHostPluginFromManifest(...)` for later health/status refresh

## 6. Recommended Host-Side Rules
These are the current recommended rules.

### Registration
- reject plugin only when negotiation mode is `enforce` and required protocol/features are missing
- otherwise allow registration and surface mismatch to operators

### Execution
- prefer normal `handlePreTurnEvent` for small contexts
- prefer `handlePreTurnEventChunked` when host/rendering limits make large context blocks awkward

### Trust / observability
- always log response `provenance.paperclip` when present
- always surface registry health results from `health()` to operators
- treat `registry-fallback` and `cache` as degraded-but-usable rather than silently equivalent to live API state

---

## 6. Example Host Pseudocode
```ts
import { createHostPluginDescriptor } from "./plugin/runtime/plugin-entry";

const descriptor = createHostPluginDescriptor({
  hostPlugin: {
    id: "blueprint-v2-memory-runtime",
    displayName: "Blueprint V2 Memory Runtime",
    version: "0.1.0",
  },
  hostExpectation: {
    protocolVersion: "host-plugin.v1",
    requiredHooks: ["preTurn", "postTurn", "health"],
  },
  negotiationPolicy: { mode: "advisory" },
});

registry.register(descriptor.id, descriptor);

const response = await descriptor.execute.handlePreTurnEvent({
  hook: "preTurn",
  eventId: "evt_123",
  runtimeInput: inbound,
  query: "what matters here?",
  intent: "active_project",
});

if (response.provenance?.paperclip?.degraded) {
  hostLogger.warn("paperclip degraded", response.provenance.paperclip);
}
```

---

## 7. Current Limits
This still does not define:
- actual OpenClaw core plugin discovery/loading mechanics
- a production registration manifest format
- host auth/session semantics
- streaming transport protocol details
- retry/ack/job orchestration semantics

But it does define the current intended shape for host-side loading and invocation.

---

## One-line summary
An OpenClaw-like host should load this plugin through `createHostPluginDescriptor()`, negotiate capabilities, register the descriptor, and invoke lifecycle helpers through the explicit host event/response contract.
