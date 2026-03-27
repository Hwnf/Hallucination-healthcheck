# Project Yoshi City — Current State Summary

> Canonical project name for this repo/workstream: **Project Yoshi City**

## Overall status
The Blueprint v2 system is now a **serious pre-production integration skeleton with trust-hardening layers**.

It has:
- Blueprint v2 canon and policy pack
- registry/state pack
- plugin scaffold with runtime hooks, adapters, policy modules, lifecycle managers, and backend integration
- live Supermemory validation
- durable audit logging
- registry validation + health signaling
- degraded-state fail-closed behavior on sensitive retrieval and mutation paths
- repeated successful smoke-suite runs after major hardening steps, including a full green aggregate suite after the Paperclip `api-only` enforcement fix
- Paperclip `api-only` degraded-state enforcement now survives adapter failure paths and fails closed in runtime hooks

---

## What is real now
### Runtime / context
- OpenClaw adapter normalization
- context resolver
- Paperclip-style context enrichment from registry-backed control-plane state
- structured Paperclip degraded provenance preserved even for `api-only` failures so hook-level fail-closed policy can execute deterministically
- pre-turn and post-turn hooks
- lifecycle-aware retrieval routing
- registry-health-aware runtime behavior
- host event envelope mapping, lifecycle execution helpers, and standardized host response envelopes
- host-side plugin registration/control state export, file persistence, and restore helpers

### Policy / enforcement
- ACL engine with deny precedence, explicit-only sensitive scopes, constraint support, and break-glass path
- registry-backed owner/readers/writers/default-policy fallback
- registry-health-aware ACL reasoning
- fail-closed degraded-state behavior for sensitive/archive retrieval paths
- scope router
- retrieval gate with contradiction suppression
- write gate with stronger scope-specific filtering
- fail-closed degraded-state behavior for sensitive mutation paths
- contradiction policy with winner/loser, coexistence, queued review, and explicit resolution handling
- contradiction reporting surface for open review queue, resolved sets, and state summaries

### Lifecycle / memory operations
- promotion manager with candidate validation and promoted-memory creation path
- archive manager with manifest persistence and archive-read gating
- experience manager
- closeout manager
- restore manager
- break-glass manager
- manager-level registry guards for promotion / archive / closeout / restore
- contradiction recording guard under degraded registry state

### Registry / trust
- writer-side schema validation for multiple registry files
- loader-side registry health reporting with warnings/errors
- registry item schema compatibility checks for versioned control-plane records
- registry bundle snapshot export/import helpers with top-level schema metadata
- controlled snapshot apply path for validated writable registries across the main registry set, with dependency-aware ordering, preflight validation, rollback of already-touched registries on apply failure, and durable apply auditing
- cache-level health access
- runtime surfacing of degraded registry health

### Backend
- real Supermemory client using live API endpoints
- live tests for connectivity, write/search, metadata round-trip, scope behavior, and conversation/session behavior
- mismatch audit performed and client mapper hardened

### Audit
- durable append-only audit log at `plugin/audit/audit.log`
- operator-facing registry snapshot apply report reader for recent/latest apply attempts, grouped by correlated applyAttemptId with merged status/duration/event history
- lifecycle audit events
- sensitive retrieval audit events
- write-denial / fail-closed audit events
- registry-health warning audit events

---

## What is semi-real / should harden next
- deeper ACL nuance for more complex role/group/resource interactions
- stronger closeout cleanup depth and restore/reopen semantics
- richer contradiction workflows beyond current coexistence/winner logic
- fuller runtime coupling to actual OpenClaw/Paperclip host behavior beyond the current persisted registration/control plane
- stronger policy choices around which degraded-state conditions should warn vs fail closed at each layer

---

## What is still intentionally lightweight
- ranking/retrieval polish
- dedup automation
- analytics/reporting
- broader taxonomy governance
- advanced backend retry/rate-limit handling
- host-native transactional protections and migration tooling

---

## Current confidence
- Architecture / canon: very high
- Policy / registry design: high
- Implementation scaffold: strong
- Trust / degraded-state behavior: materially stronger than before
- Backend integration confidence: moderate-high
- Production readiness: improved, but not final

---

## Best next hardening targets
1. deeper OpenClaw/Paperclip runtime coupling
2. deeper ACL nuance and more explicit degraded-state policy semantics
3. richer lifecycle cleanup/restore depth
4. stronger registry transactionality / migration discipline

---

## One-line summary
The system has moved from architecture + scaffolding into a tested, backend-connected Blueprint v2 implementation skeleton with meaningful trust-hardening and end-to-end host/runtime realism, and the current phase can be considered complete enough unless a specific real-world gap appears.
ng, rollback, preflight, audit, and operator-facing reporting

Future work should be treated as a **new hardening/productionization phase**, not as unfinished YoshiCity blueprint baseline work.

---

## One-line summary
The system has moved from architecture + scaffolding into a tested, backend-connected Blueprint v2 implementation skeleton with meaningful trust-hardening, and future work should focus on hardening—not expanding the surface area blindly.
