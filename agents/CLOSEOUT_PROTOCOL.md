# Closeout Protocol

## Purpose
Define the mandatory workflow for completing, freezing, distilling, archiving, and cleaning up project memory.

## Closeout Trigger States
Start closeout when project status becomes:
- `completed`
- `cancelled`
- `paused_long_term`
- `superseded`

## Mandatory Closeout Checklist
1. project marked complete/closing
2. active memory frozen
3. bottlenecks extracted
4. durable lessons reviewed
5. specialist `experience.md` updated
6. archive package created
7. access revoked/reduced
8. archive manifest written
9. low-value project residue sanitized from active scopes

## Closeout Phases
### Phase 1: Freeze
- mark project memory space as `closing`
- stop normal writes except closeout notes
- record closeout owner and timestamp

### Phase 2: Distill
Generate a closeout summary containing:
- project outcome
- deliverables completed / incomplete
- final architecture/decision summary
- unresolved risks
- blockers encountered
- reusable lessons
- candidate company promotions
- candidate governance promotions
- candidate experience entries
- archive sensitivity notes

### Phase 3: Promote
Extract into appropriate destinations:
- stable project decisions that became domain patterns -> company
- durable cross-project coordination rules -> governance
- specialist lessons -> experience
- user-specific stable preferences -> user

### Phase 4: Archive Package
Create/archive:
- final project summary
- decision index
- deliverables index
- unresolved issues list
- source references or artifact links
- access/sensitivity manifest

### Phase 5: Revoke / Reduce Access
- remove normal agent access to archived project memory
- keep orchestrator access
- keep operator/manager access per policy

### Phase 6: Sanitize Active Scopes
- remove obsolete project references from active retrieval defaults
- downgrade project memory space to `archived`
- clear low-value temporary private residues tied only to that project
- preserve extracted experience entries

## Closeout Extraction Limits
- max 5 durable lessons per specialist per project
- max 10 archive tags
- max 1 short archive summary
- max 3 company-promotion candidates

## Archive Manifest Spec
```json
{
  "archive_memory_id": "archive_project_supermemory_fork",
  "project_id": "project_supermemory_fork",
  "archived_at": "2026-03-24T14:00:00Z",
  "archived_by": "agent_orchestrator",
  "closeout_batch": "closeout_2026_03_24_supermemory_fork",
  "project_status_at_close": "completed",
  "source_memory_id": "project_supermemory_fork",
  "summary_ref": "archive://project_supermemory_fork/summary",
  "decision_index_ref": "archive://project_supermemory_fork/decisions",
  "artifact_index_ref": "archive://project_supermemory_fork/artifacts",
  "experience_extractions": ["agents/experience/orchestrator.md#timeout-handling"],
  "promotion_outputs": {
    "company": ["company_web:deployment:timeout-runbook"],
    "governance": [],
    "user": [],
    "experience": ["orchestrator:timeouts:retry-pattern"]
  },
  "access_policy": "cold_storage_default",
  "sensitivity": "internal"
}
```
