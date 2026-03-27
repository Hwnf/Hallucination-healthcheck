# Multi-Agent Memory Blueprint v2 (Public-Safe)

## Purpose
Blueprint v2 defines the operational memory model for a multi-agent system built on:
- **OpenClaw** for runtime, sessions, and messaging
- **Paperclip** for organization, governance, and task orchestration
- **Supermemory** for memory storage, retrieval, and recall primitives

It is designed to support strong memory hygiene, clean handoffs, scoped access, project archival, and long-term specialization as the system scales.

---

## Design Goals
- prevent shared-memory pollution
- preserve agent specialization without breaking collaboration
- separate active context from historical memory
- make promotion, retrieval, and archive behavior enforceable
- support scale toward large multi-agent systems without coordination collapse

---

## System Roles
### Orchestrator
Top-level coordination authority.
Can create shared memory spaces, grant/revoke access, approve promotions, finalize archive state, and inspect restricted/private scopes when policy allows and auditing exists.

### Operators / Managers / Operatives
Privileged operational roles with assigned but not blanket access.

### Agents
Execution principals that use private memory, assigned project memory, and explicitly granted company/restricted memory.

### System Services
Named automated principals used for maintenance, indexing, summaries, deduplication, or audits.

---

## Memory Hierarchy
### 0. Global Governance
System-wide rules, coordination laws, permanent standards.

### 1. Company Memory
Durable domain knowledge shared across projects in the same company.

### 2. Project Shared Memory
Live collaboration memory for active projects.

### 3. Restricted Shared Memory
Limited-scope shared memory for named groups only.

### 4. Agent Private Memory
Local durable working memory for an individual agent.

### 5. Agent Experience
Curated long-term specialization knowledge.

### 6. User Memory
User-specific persistent preferences and facts.

### 7. Session Memory
Active thread/session continuity.

### 8. Ephemeral Context
Very short-lived context that usually dies quickly unless promoted.

### 9. Cold Storage
Archived completed project memory; historical, not routine retrieval.

---

## Access Control Model
### Core Rule
Default posture: **deny unless explicitly allowed**.

### Permission Verbs
- read
- write
- update
- append
- promote
- approve
- archive
- restore
- grant
- revoke
- audit
- delete

### Canonical ACL Rules
- deny beats allow
- restricted/private/user/cold storage do not inherit by default
- project assignment grants project access only
- company membership may grant company access where policy allows
- session participation grants session access only
- archived resources stop inheritance and require explicit archive authorization
- all sensitive reads and ACL mutations are audited

### Sensitivity vs Visibility
These are separate:
- **visibility** = who may access
- **sensitivity** = how risky the content is if mishandled

---

## Write Rules and Memory Hygiene
### Write
- verified findings
- confirmed blockers
- decisions
- reusable lessons
- handoff-critical state
- durable company methods
- stable user facts/preferences

### Do Not Write
- raw chatter
- duplicate updates
- speculative noise without labeling
- verbose logs when concise summaries exist
- stale project residue
- unbounded tool output
- unnecessary secrets in broader scopes

### Compression Rule
Before broad storage or promotion, compress memory into one of:
- fact
- decision
- constraint
- policy
- playbook
- lesson
- anti-pattern
- handoff summary

---

## Promotion Model
### Core Principle
Promotion is a **lossy distillation step**.
Higher layers must contain:
- less volume
- higher confidence
- broader reuse value
- lower project-specific residue
- clearer ownership

### Default Promotion Path
- ephemeral/session -> agent_private
- agent_private -> project
- project -> company
- company -> governance

### Side Paths
- project -> experience
- agent_private -> experience
- user/session -> user
- project -> cold_storage through closeout only

### Promotion Gates
A memory should be promoted only if it passes:
1. truth/confidence gate
2. reuse gate
3. scope-fit gate
4. compression gate
5. ownership gate

### Suggested Thresholds
- to project: confidence >= 0.65
- to company: confidence >= 0.80
- to governance: confidence >= 0.90

---

## Retrieval Strategy
### Core Principle
Scope before similarity.
Search the most relevant layer first, not the largest one.

### Retrieval Defaults by Scenario
#### Active project execution
1. session
2. ephemeral
3. project
4. restricted
5. user
6. company
7. governance
8. experience

Cold storage disabled.

#### Policy/compliance question
1. governance
2. restricted
3. company
4. project

#### User personalization
1. user
2. session
3. project if task-specific

#### “How did we solve this before?”
1. project
2. experience
3. company
4. cold storage

### Hard Filters Before Ranking
- ACL visibility
- relevant project/company/user/session IDs
- active/approved status by default
- valid effective time window
- exclude archived by default
- exclude superseded by default

### Canonical Ranking Rules
1. Never retrieve archived or superseded memories by default.
2. Project memory outranks company memory for active project work.
3. Governance outranks everything for rules and safety.
4. User-confirmed preferences outrank inferred preferences.
5. Curated summaries outrank raw logs.
6. Contradictions require explicit winner/loser metadata.
7. Ephemeral memory dies quickly unless promoted.
8. Completed project memory moves to cold storage and stops polluting normal recall.

---

## Lifecycle Management
### Lifecycle State Machine
proposed -> approved -> active -> stale -> archived

Additional states:
- rejected
- superseded
- disputed
- resolved

### TTL / Review Defaults
- governance: persistent, periodic review
- company: persistent, periodic review
- project: lifecycle-bound, archive on completion or prolonged inactivity
- restricted: persistent or project-bound
- private: medium-term, stales and purges if unused
- experience: persistent curated layer
- user: persistent with periodic verification
- session: short-term
- ephemeral: minutes to task duration
- cold storage: archival only

### Stale Rule
A memory becomes stale when it is old, unverified, tied to a completed project, repeatedly outranked, or no longer relevant to active execution.

---

## Project Closeout Protocol
Project closeout is mandatory.

### Trigger States
- completed
- cancelled
- paused long-term
- superseded

### Closeout Checklist
1. project marked closing
2. active memory frozen
3. bottlenecks extracted
4. durable lessons reviewed
5. specialist experience updated
6. archive package created
7. access revoked/reduced
8. archive manifest written
9. low-value active residue sanitized

### Closeout Phases
1. freeze
2. distill
3. promote
4. archive package
5. revoke/reduce access
6. sanitize active scopes

### Extraction Limits
- max 5 durable lessons per specialist per project
- max 10 archive tags
- max 1 short archive summary
- max 3 company-promotion candidates

---

## Experience System
### What Experience Is
A curated specialist layer for:
- repeated bottlenecks
- reliable tactics
- failure signatures
- heuristics worth carrying forward

### What Experience Is Not
- raw project memory
- archive dumping
- diaries or long narrative summaries

### Experience Entry Format
- pattern
- signal
- interpretation
- action
- boundaries
- evidence
- source projects
- confidence
- last validated
- promotion candidate

---

## Metadata Themes
All important durable memory should support:
- lineage
- review state
- contradiction handling
- TTL/lifecycle state
- sensitivity/visibility separation
- retrieval hints
- provenance strength

Important fields include:
- schema_version
- memory_id
- canonical_key
- memory_type
- memory_scope
- visibility
- sensitivity
- status
- confidence
- review_status
- verification_state
- promoted_from
- promotion_state
- promotion_reason
- derived_from
- supersedes
- superseded_by
- contradiction_set
- effective_from
- effective_until
- ttl
- expires_at
- last_validated_at
- retrieval_priority
- quality_score
- dedup_key
- timestamp

---

## Registries and Files
### Existing registries
- agents.json
- companies.json
- projects.json
- memory_spaces.json

### New registries recommended
- promotions.json
- archives.json
- experience_index.json
- optionally policies.json

### Policy files
- ACL policy
- promotion rules
- retrieval policy
- lifecycle policy
- closeout protocol
- contradiction policy
- metadata schema v2

---

## Naming Conventions
Examples:
- gov_global
- company_web
- project_supermemory_fork
- restricted_billing
- agent_orchestrator_private
- archive_project_supermemory_fork

Canonical keys should describe durable meaning rather than raw source text.

---

## Initial Implementation Plan
### Minimum viable v2
1. finalize v2 docs
2. adopt metadata v2 fields
3. add promotion and closeout registries
4. enforce default deny ACLs
5. exclude archived/superseded memory by default
6. implement project closeout workflow
7. make cold storage non-routine

### Manual First, Automated Later
Can remain manual initially:
- promotion review
- archive manifest writing
- experience extraction
- contradiction resolution

Should later become automated:
- dedup checks
- stale detection
- archive packaging
- promotion candidate scoring
- ACL audit analysis

---

## One-Sentence Summary
Blueprint v2 defines a scoped, reviewable memory lifecycle in which active project context is distilled into durable experience, company standards, and rare governance rules, while completed project memory is frozen, packaged, and moved to cold storage instead of leaking into routine recall.
