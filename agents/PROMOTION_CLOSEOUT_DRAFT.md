# Promotion / Closeout Draft for Blueprint v2

This draft fills in the operational gaps between the existing Blueprint v1 and the Blueprint v2 direction already discussed: stricter lifecycle rules, clearer promotion criteria, retrieval hygiene, ACL semantics, and contradiction handling.

The goal is to make memory promotion and project closeout executable, not just aspirational.

---

## 1. Promotion Rules by Layer

### Core principle
Promotion is **not** "save anything useful." Promotion is a **lossy distillation step**.

Each higher layer must contain:
- less volume
- higher confidence
- broader reuse value
- lower project-specific residue
- clearer ownership / approval

### Promotion path
Default path:
- `ephemeral/session -> agent_private`
- `agent_private -> project`
- `project -> company`
- `company -> governance`

Side paths allowed when explicitly justified:
- `project -> experience`
- `agent_private -> experience`
- `project -> cold_storage` via closeout only
- `user/session -> user` for stable user facts/preferences

### Promotion gate requirements
A memory item should only be promoted when it passes all relevant gates:

#### A. Truth / confidence gate
Must be one of:
- directly observed and verified
- derived from repeated successful use
- explicitly approved by orchestrator/operator

Suggested thresholds:
- `project` promotion: confidence >= `0.65`
- `company` promotion: confidence >= `0.80`
- `governance` promotion: confidence >= `0.90`

If confidence is lower but worth preserving, keep it as:
- `proposed`
- `hypothesis`
- or leave it in lower-scope memory only

#### B. Reuse gate
Questions to ask:
- Will this matter again beyond the current moment?
- Is it useful to more than one agent, task, or session?
- Is it more than raw transcript residue?

If no, do not promote.

#### C. Scope-fit gate
The memory must belong to the destination layer:
- project memory = active project coordination / decisions / constraints
- company memory = cross-project standards / reusable patterns
- governance = durable global rules / coordination laws
- experience = specialist lessons, tactics, failure modes, heuristics

If the item only fits because it was rewritten too broadly, it probably should not be promoted.

#### D. Compression gate
Before promotion, rewrite into the smallest durable form that preserves value:
- decision
- rule
- pattern
- checklist item
- lesson
- anti-pattern

Do **not** promote:
- long chat excerpts
- unresolved speculation
- duplicate observations
- stale status updates

#### E. Ownership gate
Every promoted item must have:
- `written_by`
- `approved_by` or explicit auto-approval policy
- `promoted_from`
- `promotion_reason`

This keeps lineage auditable.

---

## 2. What Qualifies for Each Destination Layer

### Agent Private
Use for:
- local working heuristics
- unfinished ideas
- personal scratch patterns
- reminders not yet ready for sharing

Do not use for:
- final project decisions
- company standards
- anything that another assigned agent will likely need immediately

### Project Shared
Promote into project memory when the information is:
- relevant to active delivery
- needed for handoffs or continuity
- a verified blocker, decision, dependency, or constraint
- likely useful to multiple agents on the same project

Examples:
- chosen API strategy
- blocker with cause and owner
- confirmed deployment constraint
- completed handoff summary

Do not promote:
- transient emotional commentary
- every intermediate attempt
- tool logs unless summarized into a finding

### Company Memory
Promote from project to company only when the item is:
- reusable across multiple projects in the same company/domain
- likely stable for at least several project cycles
- expressed as a standard, pattern, playbook, or known failure mode

Examples:
- preferred stack convention
- recurring integration pattern that consistently works
- reusable launch checklist
- stable vendor constraint affecting many projects

Do not promote:
- one-project architecture quirks
- temporary vendor incidents
- client-specific preferences unless they define a whole company domain

### Governance Memory
Promote to governance only when the item is:
- globally applicable across companies/projects
- a coordination law, memory rule, access rule, or safety standard
- sufficiently stable that changing it should be rare and explicit

Examples:
- archive access policy
- contradiction-resolution policy
- promotion review policy
- global ACL model

Governance must remain extremely sparse.

### Experience Memory
Experience is **not** a copy of project memory.
It is a curated layer for:
- repeated bottlenecks
- reliable tactics
- failure signatures
- lessons learned from multiple executions
- specialist intuitions worth carrying forward

A lesson belongs in experience when it can be framed as:
- `signal -> interpretation -> action`
- `pattern -> risk -> mitigation`
- `context -> tactic -> outcome`

Experience may contain lessons extracted from a single project **only if** the lesson is likely to generalize.

---

## 3. Promotion Decision Matrix

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

---

## 4. Required Metadata Additions for v2

The v1 schema is good but incomplete for lifecycle operations.
Add these fields:

```json
{
  "memory_id": "uuid-or-provider-id",
  "canonical_key": "project_supermemory_fork:deployment:railway-timeout-rule",
  "memory_type": "decision",
  "promotion_state": "none",
  "promotion_reason": "Repeated across two handoffs and blocks delivery if forgotten",
  "review_status": "approved",
  "reviewed_at": "2026-03-24T14:00:00Z",
  "supersedes": null,
  "superseded_by": null,
  "contradicts": [],
  "derived_from": ["session_msg_123", "session_msg_128"],
  "closeout_batch": null,
  "archive_ref": null,
  "last_validated_at": "2026-03-24T14:00:00Z",
  "valid_until": null,
  "sensitivity": "internal",
  "acl_policy": "project_default",
  "retrieval_hints": ["deployment", "timeouts", "railway"],
  "quality_score": 0.84
}
```

### New / clarified enums

#### `memory_type`
- `fact`
- `decision`
- `constraint`
- `playbook`
- `lesson`
- `anti_pattern`
- `preference`
- `handoff`
- `status_summary`
- `policy`
- `hypothesis`
- `archive_manifest`

#### `promotion_state`
- `none`
- `candidate`
- `proposed`
- `approved`
- `promoted`
- `rejected`

#### `review_status`
- `unreviewed`
- `approved`
- `rejected`
- `needs_revision`
- `superseded`

#### `sensitivity`
- `public_safe`
- `internal`
- `restricted`
- `secret`

This is separate from visibility. Sensitivity describes content risk; visibility describes who may access it.

---

## 5. ACL Semantics for v2

The current blueprint has basic readers/writers lists. v2 should define policy semantics clearly.

### ACL model
Each memory space should declare:
- `owner`
- `scope`
- `default_read_policy`
- `default_write_policy`
- `review_policy`
- `promotion_policy`
- `archive_policy`

### Recommended policies

#### Governance
- read: orchestrator + designated operatives
- write: orchestrator only
- review: mandatory
- promotion: mandatory orchestrator approval

#### Company
- read: assigned agents in that company
- write: orchestrator direct, others via proposal or approved write policy
- review: required for standards/playbooks

#### Project
- read/write: assigned project agents
- review: optional for routine active coordination, required for major decisions and closeout summaries

#### Restricted Shared
- read: named group only
- write: named writers or orchestrator
- promotion out of restricted: explicit approval required

#### Agent Private
- owner read/write
- orchestrator emergency read only if policy allows
- no automatic upward promotion without transformation/review

#### Experience
- read: typically broad to relevant specialists
- write: owner agent or orchestrator-curated process
- company/governance promotion only after review

#### Cold Storage
- read: orchestrator by default; operators/managers on explicit request
- write: closeout process only
- immutable except manifest corrections / annotations

---

## 6. Retrieval Hygiene Rules

Blueprint v2 should explicitly separate **write scope** from **retrieval eligibility**.

### Retrieval defaults
- active agents retrieve from: project + allowed company + allowed restricted + own private + relevant experience
- do **not** routinely retrieve cold storage
- do **not** retrieve governance unless task requires policy/coordination context

### Ranking preference
For normal work, rank in this order:
1. active project memory
2. relevant restricted shared memory
3. company memory
4. experience memory
5. governance memory
6. cold storage only when requested or needed for precedent lookup

### Retrieval suppression rules
Suppress or down-rank items that are:
- `archived`
- `stale`
- `superseded`
- low confidence
- contradicted by newer approved memories

### Contradiction handling
When a newly approved memory conflicts with an older one:
1. mark the older item `review_status = superseded` or add `contradicts`
2. link both items bidirectionally where possible
3. preserve history; do not silently delete
4. retrieval should prefer the newest approved, highest-confidence item
5. if unresolved, surface both with conflict note instead of pretending certainty

---

## 7. Project Closeout / Archive Protocol

Project closeout should be a named workflow, not an ad hoc cleanup.

## Closeout phases

### Phase 1: Freeze
Trigger when project status becomes:
- `completed`
- `cancelled`
- `paused_long_term`
- `superseded`

Actions:
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

This becomes the authoritative closeout summary.

### Phase 3: Promote
Review project memory and extract into the right destinations:
- stable project decisions that became domain patterns -> `company`
- durable cross-project coordination rules -> `governance`
- specialist lessons -> `experience`
- user-specific stable preferences -> `user`

Nothing should jump to a broader layer without passing promotion gates.

### Phase 4: Archive package
Create/archive:
- final project summary
- decision index
- deliverables index
- unresolved issues list
- source references or external artifact links
- access/sensitivity manifest

Archive package should be written as a coherent bundle, not scattered records.

### Phase 5: Revoke / reduce access
- remove normal agent access to archived project memory
- keep orchestrator access
- keep operator/manager access only per policy
- preserve references from registries

### Phase 6: Sanitize active scopes
After archive succeeds:
- remove obsolete project references from active retrieval defaults
- downgrade project memory space to `archived`
- clear low-value temporary private residues related only to that project
- preserve extracted experience entries

---

## 8. Archive Package Specification

Each archived project should have a structured manifest.

### Archive manifest fields
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
  "experience_extractions": [
    "agents/experience/orchestrator.md#timeout-handling"
  ],
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

### Archive retrieval rule
Archived memory is for:
- precedent lookup
- audits
- postmortems
- resurrection of paused projects

It is not for routine context stuffing into active agents.

---

## 9. Experience Extraction Protocol

Experience extraction should happen on **closeout** and optionally during long-running work after major incidents.

### Extraction criteria
Create/update an experience entry when one of these is true:
- the same failure mode appeared multiple times
- a tactic repeatedly solved a class of problem
- a specialist discovered a durable heuristic
- a lesson would help future performance even if the original project is gone

### Experience entry format
Recommended canonical structure:

```md
## <lesson title>
- pattern:
- signal:
- interpretation:
- action:
- boundaries:
- evidence:
- source_projects:
- confidence:
- last_validated_at:
- promotion_candidate: yes|no
```

### Extraction rules
- write lessons, not diaries
- merge duplicates into one stronger entry
- include boundaries / when not to apply the lesson
- keep evidence traceable to projects or sessions
- mark promotion candidates for company memory only if generalizable

### Example extraction
Bad:
- "Project X was annoying because deploys broke a lot"

Good:
- `pattern:` hosted deployment fails intermittently after env changes  
- `signal:` deploy succeeds locally, remote build fails after secret rotation  
- `interpretation:` remote environment cache/config mismatch likely  
- `action:` force full rebuild, verify env propagation, then redeploy in clean order  
- `boundaries:` only applies to platforms with delayed env propagation  
- `evidence:` seen in projects A and B

---

## 10. Registry Updates for Blueprint v2

The existing registry set should be expanded.

### Existing registries to keep
- `agents.json`
- `companies.json`
- `projects.json`
- `memory_spaces.json`

### New registries recommended
- `promotions.json`
- `archives.json`
- `experience_index.json`
- optionally `policies.json`

### `promotions.json`
Track all nontrivial upward promotions.

Example:
```json
[
  {
    "promotion_id": "promo_2026_03_24_001",
    "from_memory_id": "project_supermemory_fork",
    "to_memory_id": "company_web",
    "canonical_key": "deployment:timeout-runbook",
    "requested_by": "agent_orchestrator",
    "approved_by": "agent_orchestrator",
    "reason": "Observed repeatedly and useful across web projects",
    "status": "approved",
    "timestamp": "2026-03-24T14:00:00Z"
  }
]
```

### `archives.json`
Tracks all closed/archived projects.

Example:
```json
[
  {
    "archive_id": "closeout_2026_03_24_supermemory_fork",
    "project_id": "project_supermemory_fork",
    "archive_memory_id": "archive_project_supermemory_fork",
    "status": "archived",
    "archived_by": "agent_orchestrator",
    "archived_at": "2026-03-24T14:00:00Z"
  }
]
```

### `experience_index.json`
Maps agents/specialties to curated experience files and notable lesson keys.

Example:
```json
[
  {
    "experience_owner": "agent_orchestrator",
    "file": "agents/experience/orchestrator.md",
    "lesson_keys": [
      "timeouts:retry-pattern",
      "handoff:summary-minimum"
    ],
    "last_updated": "2026-03-24T14:00:00Z"
  }
]
```

---

## 11. Project Registry Schema Updates

Recommended additions to `projects.json`:

```json
{
  "closeout_policy": {
    "required": true,
    "extract_experience": true,
    "promotion_review_required": true,
    "archive_bundle_required": true,
    "revoke_default_access_on_archive": true
  },
  "lifecycle_state": "active",
  "closeout_owner": "agent_orchestrator",
  "closeout_summary_ref": null,
  "archive_manifest_ref": null,
  "last_closeout_attempt": null
}
```

Suggested `lifecycle_state` enum:
- `planned`
- `active`
- `closing`
- `archived`
- `paused`
- `cancelled`

---

## 12. Memory Space Registry Schema Updates

Recommended additions to `memory_spaces.json`:

```json
{
  "owner": "agent_orchestrator",
  "default_read_policy": "project_assigned",
  "default_write_policy": "project_assigned",
  "review_policy": "major_decisions_review",
  "promotion_policy": "orchestrator_review",
  "archive_policy": "archive_on_close",
  "retrieval_default": true,
  "retrieval_rank": 1,
  "immutable": false,
  "supersession_mode": "link_not_delete"
}
```

This makes retrieval, review, and archive behavior explicit rather than implicit.

---

## 13. Recommended Blueprint v2 Table of Contents

# Multi-Agent Memory Blueprint v2

1. **Purpose and Design Goals**
   - Why this system exists
   - Separation of OpenClaw / Paperclip / Supermemory
   - Core failure modes the design prevents

2. **System Roles and Operating Model**
   - Orchestrator
   - Operators / managers
   - Agents
   - Companies and projects as memory domains

3. **Memory Hierarchy and Scope Definitions**
   - Governance
   - Company
   - Project
   - Restricted Shared
   - Agent Private
   - Experience
   - User
   - Session
   - Ephemeral
   - Cold Storage

4. **Access Control and ACL Semantics**
   - Ownership
   - Reader/writer policies
   - Restricted scopes
   - Sensitivity vs visibility
   - Emergency access

5. **Write Rules and Memory Hygiene**
   - What to write
   - What not to write
   - Compression / summarization requirements
   - Anti-noise rules

6. **Promotion Model**
   - Promotion paths
   - Promotion gates
   - Approval rules
   - Destination criteria
   - Promotion metadata / lineage

7. **Retrieval Strategy**
   - Retrieval defaults by role
   - Ranking and suppression
   - Cold storage retrieval rules
   - Contradiction handling and supersession

8. **Lifecycle Management**
   - Active project behavior
   - Pause / cancel / complete transitions
   - Closeout trigger states
   - Archive boundaries

9. **Project Closeout Protocol**
   - Freeze
   - Distill
   - Promote
   - Archive package
   - Access revocation
   - Active-scope cleanup

10. **Experience System**
    - What experience is
    - Extraction criteria
    - File/template format
    - Promotion from experience to company/governance

11. **Metadata Schema**
    - Core fields
    - Enums
    - Lineage fields
    - Review / contradiction / validation fields

12. **Registries and Filesystem Layout**
    - Registry files
    - Template files
    - Archive manifests
    - Experience index

13. **Naming Conventions and Canonical Keys**
    - Memory IDs
    - Archive IDs
    - Canonical key conventions

14. **Operational Examples**
    - Example promotion
    - Example contradiction update
    - Example closeout bundle
    - Example archive retrieval

15. **Initial Implementation Plan**
    - Minimum viable v2
    - What can remain manual first
    - What should be automated later

---

## 14. Recommended Minimum v2 Decisions to Lock In Now

If only a few things are finalized immediately, they should be these:

1. **Promotion is gated and lossy** — higher scopes are curated, not dumps.
2. **Closeout is mandatory** for project completion and creates an archive manifest.
3. **Experience is a first-class layer** distinct from project memory and company memory.
4. **Cold storage is excluded from routine retrieval**.
5. **Contradictions are linked, not silently overwritten**.
6. **Sensitivity and visibility are separate fields**.
7. **Every important durable memory has lineage metadata**.

These seven decisions give the architecture its operational spine.

---

## 15. Suggested One-Sentence v2 Summary

Blueprint v2 defines a scoped, reviewable memory lifecycle in which active project context is distilled into durable experience, company standards, and rare governance rules, while completed project memory is frozen, packaged, and moved to cold storage instead of leaking into routine recall.
