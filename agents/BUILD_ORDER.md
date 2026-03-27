# Build Order

## Purpose
Provide a clean implementation sequence so the system is built in the right order.

## Phase 0 — Lock Structure
Before coding:
- finalize Blueprint v2 as canon
- finalize registry structures
- finalize metadata schema v2
- finalize naming conventions
- finalize engineering MVP brief
- finalize source-of-truth map

**Done means:** docs and registries are stable enough that code will not chase moving targets.

## Phase 1 — Build the Safety Spine
Implement:
- ACL engine
- retrieval hard filters
- archived/superseded exclusion
- cold-storage isolation

**Goal:** prevent bad memory from poisoning runtime.

**Done means:**
- unauthorized reads/writes are blocked
- active retrieval does not include archived or superseded memory
- cold storage is unreachable by default

## Phase 2 — Build Memory Operations
Implement:
- promotion workflow
- closeout workflow
- archive manifest handling
- minimal contradiction marking

**Goal:** make memory lifecycle operational, not aspirational.

**Done means:**
- promotions can be proposed and approved
- project closeout creates archive outputs
- extracted lessons can persist while low-value residue is removed

## Phase 3 — Platform Integration
Map:
- OpenClaw sessions -> `conversationId`
- user identity -> container/tag conventions
- project/company scopes -> Supermemory containers + metadata
- Paperclip entities -> org/project/control layer

**Goal:** connect the blueprint to real runtime behavior.

**Done means:**
- runtime sessions write/read using the agreed identifiers
- memory scopes map cleanly into the backend
- org/project structure is reflected in the control layer

## Phase 4 — Live Calibration
Run one real project through the system:
- `project_supermemory_fork`

Observe:
- retrieval quality
- promotion burden
- archive usefulness
- ACL friction
- closeout clarity

**Goal:** validate the system under real use before scaling agent count.

## Phase 5 — Automation Later
Only after the system is operationally safe:
- dedup automation
- stale detection
- promotion scoring
- archive tooling
- richer contradiction handling
- analytics and tuning

## Build Rule
Do not automate instability.
Lock the safety spine first, then the lifecycle, then the integrations, then the polish.
