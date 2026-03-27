# Promotion Rules

## Purpose
Define how memory moves upward across scopes without polluting higher layers.

## Core Principle
Promotion is a **lossy distillation step**. Higher layers should contain:
- less volume
- higher confidence
- broader reuse value
- lower project-specific residue
- clearer ownership and approval

## Default Promotion Path
- `ephemeral/session -> agent_private`
- `agent_private -> project`
- `project -> company`
- `company -> governance`

## Side Paths
Allowed only when justified:
- `project -> experience`
- `agent_private -> experience`
- `user/session -> user`
- `project -> cold_storage` via closeout only

## Promotion Gates
A memory item should only be promoted when it passes all relevant gates.

### 1. Truth / Confidence Gate
Must be one of:
- directly observed and verified
- derived from repeated successful use
- explicitly approved by orchestrator/operator

Suggested thresholds:
- `project` promotion: confidence >= `0.65`
- `company` promotion: confidence >= `0.80`
- `governance` promotion: confidence >= `0.90`

### 2. Reuse Gate
Ask:
- Will this matter again beyond the current moment?
- Is it useful to more than one agent, task, or session?
- Is it more than raw transcript residue?

If no, do not promote.

### 3. Scope-Fit Gate
Destination rules:
- **project** = active coordination, decisions, constraints, blockers, handoffs
- **company** = cross-project standards, reusable patterns, stable workflows
- **governance** = durable global rules, coordination laws, access/safety rules
- **experience** = specialist lessons, heuristics, repeated bottlenecks, failure signatures

### 4. Compression Gate
Before promotion, rewrite into the smallest durable form that preserves value:
- decision
- rule
- pattern
- checklist item
- lesson
- anti-pattern

Do not promote:
- long chat excerpts
- unresolved speculation
- duplicate observations
- stale status updates

### 5. Ownership Gate
Every promoted item must have:
- `written_by`
- `approved_by` or explicit auto-approval policy
- `promoted_from`
- `promotion_reason`

## Promotion Decision Matrix
### Promote immediately
- confirmed project decisions
- confirmed blockers with owners/next step
- handoff-critical context
- stable user preference updates

### Promote after review
- company standards
- governance rules
- restricted shared memory
- anything that changes access assumptions
- anything with unresolved counterevidence

### Never promote directly
- raw transcripts
- temporary debug spam
- tool output without interpretation
- secrets copied unnecessarily into broader scopes
- speculative claims without labeling

## Promotion State
Recommended values:
- `none`
- `candidate`
- `proposed`
- `approved`
- `promoted`
- `rejected`

## Required Promotion Metadata
```json
{
  "promotion_state": "candidate",
  "promotion_reason": "Repeated across two handoffs and blocks delivery if forgotten",
  "review_status": "approved",
  "reviewed_at": "2026-03-24T14:00:00Z",
  "promoted_from": "project",
  "approved_by": "agent_orchestrator",
  "derived_from": ["session_msg_123", "session_msg_128"]
}
```

## Canonical Rule Summary
1. Higher scopes are curated, not dumps.
2. Promotion requires confidence, reuse, and scope fit.
3. Promotion should preserve lineage.
4. Governance must stay sparse.
5. Experience is curated lessons, not archived project residue.
