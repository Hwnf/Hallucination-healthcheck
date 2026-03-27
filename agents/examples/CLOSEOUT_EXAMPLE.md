# Closeout Example

## Scenario
The `project_supermemory_fork` project is completed.

## Closeout Phases
### 1. Freeze
- mark project lifecycle state as `closing`
- stop normal writes except closeout notes

### 2. Distill
Create summary covering:
- outcome
- final decisions
- blockers encountered
- unresolved risks
- reusable lessons

### 3. Promote
Extract:
- reusable deployment timeout runbook -> `company_web`
- orchestration lesson about handoff minimums -> `experience`

### 4. Archive Package
Create:
- summary
- decision index
- artifact index
- unresolved issues list
- access/sensitivity manifest

### 5. Revoke Access
- remove routine project access for normal agents
- keep orchestrator access
- keep operator/manager archive access per policy

### 6. Sanitize Active Scopes
- remove active retrieval defaults for archived project memory
- wipe low-value specialized project residue
- keep curated `experience.md` lessons

## Example Archive Manifest
```json
{
  "archive_memory_id": "archive_project_supermemory_fork",
  "project_id": "project_supermemory_fork",
  "archived_at": "2026-03-24T14:47:00Z",
  "archived_by": "agent_orchestrator",
  "closeout_batch": "closeout_2026_03_24_supermemory_fork",
  "project_status_at_close": "completed",
  "summary_ref": "archive://project_supermemory_fork/summary",
  "decision_index_ref": "archive://project_supermemory_fork/decisions",
  "artifact_index_ref": "archive://project_supermemory_fork/artifacts",
  "promotion_outputs": {
    "company": ["company_web:deployment:timeout-runbook"],
    "governance": [],
    "user": [],
    "experience": ["orchestrator:handoff:summary-minimum"]
  },
  "access_policy": "cold_storage_default",
  "sensitivity": "internal"
}
```
