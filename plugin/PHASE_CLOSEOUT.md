# Project Yoshi City — Blueprint v2 Phase Closeout

> Canonical project name for this repo/workstream: **Project Yoshi City**

## Phase verdict
Blueprint v2 is **complete enough for this phase**.

This does **not** mean the system is fully production-complete.
It means the YoshiCity blueprint baseline is now strong enough that additional work should be treated as:
- productionization
- operator UX expansion
- policy-depth refinement
- backend/runtime hardening

rather than as unfinished Blueprint v2 core work.

---

## Final verification status
Latest status at closeout:
- aggregate smoke suite: **green**
- host/runtime composed path coverage: **green**
- contradiction review/reporting coverage: **green**
- registry/control-plane trust coverage: **green**
- Paperclip enforcement/source-policy coverage: **green**
- Supermemory live integration coverage: **present and previously validated**

Primary runner used during closeout:
- `npx --yes tsx plugin/tests/run-all-smokes.ts`

---

## What was completed in this phase

### Runtime / host realism
- manifest-driven host plugin loading
- manifest-loaded descriptor execution through preTurn/postTurn/health
- manifest-loaded degraded runtime behavior
- manifest-loaded degraded host controller policy behavior
- manifest-loaded host override vs runtime-degraded semantics
- host manifest / loader / negotiation / controller / lifecycle / policy / reconcile / disable-enable / persistence flows

### Paperclip behavior
- Paperclip client + adapter scaffolding
- provenance/source-of-truth signaling
- runtime degraded-state signaling
- `api-only` fail-closed enforcement fix so degraded provenance survives adapter failure paths
- host-visible degraded Paperclip semantics through manifest-loaded execution paths

### Registry / control plane trust
- registry validation
- atomic registry writes
- atomic manager mutation writes on key lifecycle paths
- registry schema compatibility checks
- bundle snapshot export/import
- validated bundle apply across main registries
- dependency-aware ordering
- rollback on apply failure
- preflight dependency validation
- durable snapshot-apply audit events
- operator-facing snapshot apply report reader
- correlated `applyAttemptId`
- grouped status/duration/event-history reporting

### Lifecycle / memory operations
- promotion manager
- archive manager + manifest persistence
- closeout manager
- restore manager
- experience manager
- break-glass manager
- registry guards on mutation paths
- stronger restore semantics and audit coverage

### ACL / enforcement
- ACL baseline engine
- deny precedence
- registry-backed fallback reasoning
- degraded-state fail-closed enforcement at ACL/runtime layers
- write gate + lifecycle write gate
- break-glass path

### Contradiction workflow
- contradiction detection
- auto-resolution winner/loser behavior
- coexistence / scope-split handling
- degraded registry guard behavior
- queued review state (`suspected`)
- explicit later resolution
- contradiction report reader for:
  - open review queue
  - resolved sets
  - state summaries

### Backend integration
- real Supermemory integration
- live validation for connectivity / write / search / metadata / scope / conversation behavior
- mismatch audit / mapper hardening

### Audit / reporting
- durable append-only local audit log
- lifecycle audit events
- sensitive retrieval audit events
- write/fail-closed audit events
- registry-health warning audit events
- snapshot-apply lifecycle audit + reporting surface

---

## Intentionally deferred to a future phase
These are not considered blocking for YoshiCity blueprint baseline completion.

### Policy / ACL depth
- richer role/group inheritance
- deeper constraint semantics
- more exhaustive per-registry/per-action degraded-state distinctions

### Lifecycle depth
- fuller restore reconstruction of broader operational context
- deeper freeze/unfreeze/reassignment enforcement across every possible path

### Contradiction/operator depth
- richer operator action surface beyond registry-backed reporting
- deeper lineage updates written back into memory records themselves

### Runtime / backend productionization
- fully production-native Paperclip integration beyond current stand-in/control-plane coupling
- fully native OpenClaw core embedding beyond current manifest-loaded host/runtime proof paths
- richer backend retry/rate-limit/error classification behavior

### Control-plane productionization
- true transactional commit protocol
- automatic migration framework
- stronger repair tooling / health dashboard / external audit sink

---

## Recommended stop point
Stop adding new YoshiCity blueprint baseline features unless a real usage gap appears.

The current best framing is:
- YoshiCity blueprint baseline: **done enough**
- next phase: **productionization / deeper hardening**

---

## If work resumes later
Start by deciding whether the goal is one of these:

1. **Productionization**
   - stronger backend reliability
   - stronger operational tooling
   - stronger audit/repair surfaces

2. **Policy depth**
   - ACL nuance
   - degraded-state semantics refinement
   - contradiction workflow expansion

3. **Runtime-native embedding**
   - deeper OpenClaw-native integration
   - deeper Paperclip-native integration

Do **not** resume with another generic hardening pass by default.
Pick a branch deliberately.

---

## Current project posture
Best short description:

> A tested, backend-connected Blueprint v2 implementation skeleton with meaningful trust-hardening, composed host/runtime proof paths, contradiction review/reporting, and a green aggregate smoke suite.
