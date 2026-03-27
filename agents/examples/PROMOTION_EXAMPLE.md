# Promotion Example

## Scenario
A deployment timeout mitigation pattern is discovered repeatedly during the `project_supermemory_fork` project.

## Source Context
- scope: project
- company: `company_web`
- project: `project_supermemory_fork`
- originating agent: `agent_orchestrator`

## Raw Project-Level Finding
- remote deploys intermittently fail after environment changes
- forcing a clean rebuild and verifying env propagation resolves the issue reliably
- observed multiple times during active project work

## Why It Qualifies For Promotion
- reusable across future web projects
- not specific to one user/session
- has repeated evidence
- can be compressed into a concise operational rule

## Compressed Durable Form
**Pattern:** deployment timeout after env/config mutation

**Signal:** local success, remote timeout or inconsistent remote behavior after config/env updates

**Action:**
1. verify environment propagation
2. force clean rebuild
3. redeploy in controlled order
4. confirm remote state matches intended config

**Boundaries:** applies where deploy platforms cache stale config/build state

## Promotion Decision
- from: `project_supermemory_fork`
- to: `company_web`
- approved_by: `agent_orchestrator`
- confidence: `0.84`
- promotion_state: `approved`
- canonical_key: `deployment:timeout-runbook`

## Example Metadata
```json
{
  "schema_version": "2.0",
  "memory_id": "mem_promo_example_001",
  "canonical_key": "deployment:timeout-runbook",
  "memory_type": "playbook",
  "agent_id": "agent_orchestrator",
  "company_id": "company_web",
  "project_id": "project_supermemory_fork",
  "memory_scope": "company",
  "visibility": "shared",
  "sensitivity": "internal",
  "written_by": "agent_orchestrator",
  "approved_by": "agent_orchestrator",
  "promoted_from": "project",
  "promotion_state": "approved",
  "promotion_reason": "Observed repeatedly and reusable across web projects",
  "review_status": "approved",
  "status": "active",
  "confidence": 0.84,
  "verification_state": "verified",
  "derived_from": ["project_supermemory_fork"],
  "tags": ["deployment", "timeouts", "runbook"],
  "timestamp": "2026-03-24T14:47:00Z"
}
```
