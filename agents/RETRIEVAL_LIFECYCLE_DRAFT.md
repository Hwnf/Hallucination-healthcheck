# Retrieval, Contradiction, Ranking, Staleness, and Lifecycle Spec

## Purpose
This document turns the memory blueprint into an operational retrieval and lifecycle spec for the OpenClaw + Paperclip + Supermemory system.

It defines:
- retrieval order and query strategy
- ranking and trust scoring
- contradiction detection and resolution
- stale suppression and freshness handling
- lifecycle and TTL rules by memory layer
- promotion, demotion, archival, and purge behavior

The intent is to keep recall useful, low-noise, and safe as the system scales from a small agent team to a larger multi-agent network.

---

## 1. Core Principles

1. **Scope before similarity**
   Retrieval should search the most relevant memory layer first, not the largest one.

2. **Freshness matters, but truth matters more**
   Newer memory should outrank older memory only when both have similar authority and confidence.

3. **Resolved contradictions must not keep resurfacing**
   Once a fact is superseded or resolved, older conflicting memories should be downranked or hidden by default.

4. **Project chatter should decay aggressively**
   Shared project memory is useful while active and noisy afterward.

5. **Durable knowledge must be curated, not accumulated blindly**
   Promotion upward is selective; archive downward is cheap.

6. **Private recall must not leak across ACL boundaries**
   Retrieval only considers memories visible to the requesting agent/session/user.

---

## 2. Memory Layers and Retrieval Roles

### Layer order
From highest-level durable policy to lowest-level temporary context:

1. Global Governance
2. Company Memory
3. Project Shared Memory
4. Restricted Shared Memory
5. Agent Private Memory
6. Agent Experience
7. User Memory
8. Session Memory
9. Ephemeral Context
10. Cold Storage

### Operational retrieval roles
Not every layer is searched on every query.

- **Session/Ephemeral**: immediate continuity, current thread state, active task context
- **User**: user preferences, durable user facts, relationship continuity
- **Project**: active decisions, blockers, constraints, current architecture
- **Restricted Shared**: role-gated facts for a subset of agents
- **Company**: durable reusable methods and standards
- **Governance**: hard rules, coordination protocol, safety/policy
- **Agent Private**: agent-local heuristics and working notes
- **Agent Experience**: distilled lessons and repeatable playbooks
- **Cold Storage**: archive retrieval only when explicitly requested or strongly indicated by a current project relationship

---

## 3. Required Metadata

Each memory item should carry or derive the following fields.

```json
{
  "memory_id": "uuid-or-provider-id",
  "container": "project_supermemory_fork",
  "memory_scope": "project",
  "visibility": "shared",
  "company_id": "company_web",
  "project_id": "project_supermemory_fork",
  "agent_id": "agent_orchestrator",
  "user_id": "user_123",
  "conversation_id": "discord_1485839353149391020",
  "topic_keys": ["retrieval", "memory-policy"],
  "summary": "short canonical summary",
  "confidence": 0.86,
  "importance": "high",
  "status": "active",
  "retention": "project_lifecycle",
  "created_at": "2026-03-24T03:15:00Z",
  "updated_at": "2026-03-24T03:20:00Z",
  "last_verified_at": "2026-03-24T03:20:00Z",
  "effective_from": "2026-03-24T03:20:00Z",
  "effective_until": null,
  "supersedes": ["older_memory_id"],
  "superseded_by": null,
  "contradiction_set": null,
  "resolution_state": "none",
  "source_type": "human|agent|tool|system",
  "source_ref": "message/tool/document reference",
  "approved_by": "agent_orchestrator",
  "promotion_state": "native|promoted|candidate",
  "retrieval_hints": {
    "default_searchable": true,
    "cold_only": false,
    "pin_until": null
  }
}
```

### Additional recommended fields
- `entity_keys`: normalized entities referenced by the memory
- `fact_type`: `policy | preference | decision | observation | hypothesis | task_state | profile | lesson`
- `verification_state`: `unverified | provisional | verified | disputed | resolved`
- `decay_class`: `none | slow | medium | fast | immediate`
- `access_tags`: ACL labels used at retrieval time
- `quality_score`: optional offline curation score

---

## 4. Retrieval Pipeline

### 4.1 Query classification
Every retrieval request should first classify the query into one or more intents:

- policy/rule lookup
- active task lookup
- project history lookup
- user preference lookup
- agent self-recall
- reusable best-practice lookup
- archived history lookup
- factual disambiguation / contradiction check

### 4.2 Scope selection
Select candidate scopes before vector/semantic retrieval.

#### Default scope routing
- **Current conversation/task**: session -> ephemeral -> project -> user
- **Current project architecture/decisions**: project -> restricted -> company -> cold storage only if needed
- **User preference/personal continuity**: user -> session
- **Agent workflow recall**: private -> experience
- **Rules/permissions/protocols**: governance -> restricted -> company
- **How we solved similar issue before**: project -> experience -> company -> cold storage

### 4.3 Hard filters
Before ranking, filter by:
- ACL visibility
- relevant company/project/user/session IDs
- allowed statuses: default `active`, optionally `approved`, maybe `stale` with heavy penalty
- `effective_from <= now`
- `effective_until == null || effective_until > now`
- exclude `archived` unless archive mode is enabled
- exclude `superseded` by default unless explicit history/debug mode

### 4.4 Candidate generation
For each permitted scope:
1. semantic/vector retrieval
2. metadata filter retrieval
3. exact-keyword / entity-key retrieval
4. pinned/explicit references

Merge candidates by memory ID and deduplicate near-identical chunks.

### 4.5 Scope budget
Use a bounded retrieval budget so wide containers do not drown local context.

Recommended initial budget per query:
- session/ephemeral: up to 8 items
- user: up to 5 items
- project: up to 8 items
- restricted: up to 4 items
- company: up to 5 items
- governance: up to 3 items
- private: up to 4 items
- experience: up to 4 items
- cold storage: 0 by default, up to 5 when enabled

### 4.6 Assembly rule
When building final context for the model:
1. always include highest-confidence active session/task facts first
2. include at most 1-3 governance rules if directly relevant
3. include only the latest canonical version of conflicting memories
4. prefer summaries over raw logs when both exist
5. prefer promoted/curated items over noisy lower-level variants

---

## 5. Ranking Model

Ranking should combine semantic similarity with authority, freshness, and resolution state.

### 5.1 Recommended scoring formula

```text
final_score =
  (0.35 * semantic_similarity)
+ (0.20 * scope_relevance)
+ (0.15 * authority_score)
+ (0.10 * freshness_score)
+ (0.08 * confidence_score)
+ (0.05 * importance_score)
+ (0.04 * verification_score)
+ (0.03 * quality_score)
- stale_penalty
- superseded_penalty
- contradiction_penalty
- noise_penalty
```

Weights can be tuned, but the behavior should remain:
- semantic match matters most
- local scope relevance matters next
- authoritative and verified memories beat weak fresh ones
- stale, superseded, and noisy items are actively suppressed

### 5.2 Scope relevance prior
Recommended prior by query context:

#### If query is about current task/project
- session: 1.00
- ephemeral: 0.95
- project: 0.90
- restricted: 0.75
- user: 0.70
- company: 0.65
- governance: 0.60
- private: 0.55
- experience: 0.55
- cold_storage: 0.20

#### If query is about durable best practices
- experience: 1.00
- company: 0.95
- governance: 0.85
- project: 0.65
- private: 0.60
- cold_storage: 0.40
- session/user/ephemeral: as relevant but low by default

### 5.3 Authority score
Suggested order:
- governance approved rule: 1.00
- company approved durable standard: 0.92
- project decision approved by orchestrator/owner: 0.88
- user-confirmed preference/fact: 0.88
- experience lesson curated from repeated outcomes: 0.84
- tool-verified observation: 0.80
- active project note from assigned agent: 0.72
- private heuristic: 0.60
- unverified observation/hypothesis: 0.40

### 5.4 Freshness score
Freshness should vary by layer, not use one global curve.

- session/ephemeral: steep decay over hours
- project: meaningful decay over days/weeks
- company/experience/governance: slow decay over months
- user preferences: medium decay unless re-affirmed
- cold storage: no freshness bonus, only historical relevance

### 5.5 Noise penalty
Apply penalties for:
- duplicate restatements
- verbose logs when concise summaries exist
- unresolved task chatter
- low-information handoff fragments
- agent speculation without verification

---

## 6. Contradiction Handling

Contradictions are expected in a multi-agent system. They must be tracked explicitly.

### 6.1 Contradiction definition
Two or more memories are contradictory when they assert incompatible values about the same entity/fact within overlapping time validity windows.

Examples:
- stack is `Next.js` vs stack is `Remix`
- project status is `blocked` vs `unblocked`
- user prefers terse replies vs user prefers detailed replies

### 6.2 Contradiction dimensions
Each contradiction should be evaluated along:
- same entity?
- same fact type?
- same temporal window?
- same authority level or not?
- one supersession event present?
- one verified and one provisional?

### 6.3 Resolution states
Use:
- `none`
- `suspected`
- `disputed`
- `resolved`
- `superseded`
- `coexisting` (both can be true in different contexts/times)

### 6.4 Resolution rules

#### Rule A: explicit supersession wins
If a newer item explicitly says it supersedes an older one, the older item becomes non-default in retrieval.

#### Rule B: higher authority wins by default
If two active memories conflict and one has clearly higher authority, rank the higher-authority memory first and flag the lower one as disputed.

#### Rule C: verified beats unverified
Tool-verified or user-confirmed facts outrank agent inference.

#### Rule D: more specific scope wins for local execution
For current-task execution, a project-specific decision can override a company default, and a session-specific clarification can override a project default, as long as it does not violate governance.

Precedence:
- governance cannot be overridden by lower layers unless governance itself allows local override
- user preference can override generic style defaults
- project decision can override company default for that project
- session clarification can override temporary execution choices for that conversation

#### Rule E: temporal partitioning may reconcile contradiction
If both memories apply at different times, mark them `coexisting` with proper `effective_from/effective_until` instead of treating as a true conflict.

### 6.5 Contradiction registry
Each contradiction set should maintain:
- `contradiction_set_id`
- involved memory IDs
- entity key / fact key
- resolution owner
- current winner
- reason (`authority`, `verification`, `recency`, `explicit override`, `time-bounded coexistence`)
- resolution timestamp

### 6.6 Model-facing behavior
By default, the agent should receive:
- the winning memory
- optionally a brief note that older conflicting memory exists if uncertainty remains

Only include both sides when:
- the contradiction is unresolved
- the user asks for history/debugging
- the decision materially affects output quality or safety

---

## 7. Stale Suppression

Staleness is not the same as contradiction.
A memory can be uncontested but still no longer useful.

### 7.1 Stale criteria
A memory becomes `stale` when one or more apply:
- older than its expected review window without re-verification
- tied to a completed project lifecycle
- references obsolete tooling/architecture/versioning
- frequently outranked by newer canonical summaries
- task-state memory after task closure
- user preference not observed or reaffirmed over a long period

### 7.2 Stale suppression behavior
Default retrieval should:
- hide stale items when active alternatives exist
- heavily downrank stale items when no active alternative exists
- surface stale items only with a warning if they are the only relevant history

### 7.3 Stale penalties by layer
Suggested default:
- session: suppress after inactivity/closure immediately
- ephemeral: near-total suppression after task ends
- project: strong suppression after archive or inactivity threshold
- private: medium suppression if not touched for long periods
- experience/company/governance: mild suppression, mainly review reminders
- cold storage: not “stale”; historical by design

### 7.4 Canonical summary preference
If a project has both:
- raw decision thread
- curated decision summary

Then raw thread items get a noise/stale penalty unless explicit forensic retrieval is requested.

---

## 8. Lifecycle and TTL Rules

TTL means expected active-retrieval lifetime, not guaranteed hard deletion in every case. Some layers decay to archive instead of delete.

## 8.1 Governance
- **Retention:** persistent
- **TTL:** none
- **Review cadence:** every 90-180 days or when policy changes
- **Stale rule:** almost never stale; instead version and supersede
- **Archive:** old versions retained, non-default

## 8.2 Company Memory
- **Retention:** persistent
- **Default TTL:** none, but review every 60-120 days
- **Use:** standards, reusable workflows, durable preferences
- **Demotion:** if project-specific and no longer broadly applicable
- **Archive:** old standards archived/superseded, not deleted

## 8.3 Project Shared Memory
- **Retention:** project lifecycle
- **Active TTL:** while project is active
- **Soft stale threshold:** 14 days inactive
- **Archive threshold:** on project completion, cancellation, or 30 days inactive by default
- **After archival:** no default retrieval except explicit archive mode or linked-project retrieval

### Project close flow
1. freeze write-heavy project chatter
2. extract durable lessons -> experience/company as appropriate
3. create curated project summary
4. mark unresolved items clearly
5. archive remaining project memory
6. revoke routine retrieval from active agents

## 8.4 Restricted Shared Memory
- **Retention:** persistent or project-bound, depending on namespace
- **TTL:** none if operationally durable; otherwise match project lifecycle
- **Review cadence:** every 30-90 days
- **Special rule:** ACL remains strict even after archival

## 8.5 Agent Private Memory
- **Retention:** medium-term persistent
- **Soft stale threshold:** 30 days since last use/update
- **Review cadence:** 30-60 days
- **Purge threshold:** 90-180 days for low-value notes unless pinned or promoted
- **Promotion path:** repeated useful private heuristics -> experience or project/company memory

## 8.6 Agent Experience
- **Retention:** persistent curated memory
- **TTL:** none
- **Review cadence:** every 60-120 days
- **Rule:** should contain synthesized lessons, not raw anecdotes
- **Supersession:** older playbooks remain historical but non-default when replaced

## 8.7 User Memory
- **Retention:** persistent but privacy-sensitive
- **Classes:**
  - stable facts: no TTL, periodic verification
  - preferences: review every 90-180 days
  - transient circumstances: 7-30 days unless reaffirmed
- **Rule:** user-confirmed facts outrank inferred preferences
- **Suppression:** inferred preferences decay quickly unless reinforced by repeated observations

## 8.8 Session Memory
- **Retention:** short-term
- **TTL:** active conversation duration + 24-72h grace
- **Soft stale threshold:** inactivity >24h
- **Hard suppression:** after thread ends or new unrelated thread takes over
- **Promotion:** only decisions, explicit user facts, or important project state should be promoted upward

## 8.9 Ephemeral Memory
- **Retention:** very short-term
- **TTL:** minutes to current task duration
- **Hard purge:** after task completion unless explicitly promoted
- **Use:** scratchpad reasoning, temporary extracted snippets, short-lived working context

## 8.10 Cold Storage
- **Retention:** archival
- **TTL:** none
- **Default retrieval:** off
- **Trigger conditions:** explicit request, comparable-project search, audit/debug, postmortem, migration work
- **Behavior:** retrieval result should be labeled historical and non-authoritative unless revalidated

---

## 9. Promotion and Demotion Rules

### Promote upward when memory is:
- repeatedly useful across sessions/tasks
- verified or user-confirmed
- reusable beyond one narrow incident
- concise enough to be recalled cheaply
- safe to share at the higher ACL level

### Do not promote when memory is:
- unresolved chatter
- temporary status updates
- duplicate restatements
- emotionally salient but operationally useless
- private without clear need-to-share

### Demote or archive when memory is:
- project-bound and project has ended
- replaced by a better summary
- repeatedly outranked and unused
- no longer accurate or actively supported

---

## 10. Retrieval Defaults by Scenario

### A. Active project execution
Search order:
1. session
2. ephemeral
3. project
4. restricted
5. user
6. company
7. governance
8. experience

Cold storage disabled.

### B. Policy/compliance question
Search order:
1. governance
2. restricted
3. company
4. project

Only include lower-scope overrides if governance allows them.

### C. User personalization
Search order:
1. user
2. session
3. project if task-specific

Agent private memory should not influence user-fact recall unless explicitly promoted.

### D. “How did we solve this before?”
Search order:
1. project
2. experience
3. company
4. cold storage

Prefer curated summaries and experience notes over raw archive items.

### E. Self-improvement / agent operations
Search order:
1. private
2. experience
3. project/company as relevant

---

## 11. Write-Time Rules That Improve Retrieval

To keep retrieval quality high, memory writes should obey:

1. **One fact/decision per item when possible**
2. **Explicit entity names and IDs**
3. **Set effective time windows when facts change**
4. **Use `supersedes` on updates**
5. **Mark uncertainty explicitly**
6. **Prefer curated summaries for large discussions**
7. **Attach ACL tags at write time, not after the fact**
8. **Avoid storing chain-of-thought or speculative filler as durable memory**

---

## 12. Minimal Operational State Machine

Each memory item should move through a simple lifecycle:

```text
proposed -> approved -> active -> stale -> archived
                \-> rejected
active -> superseded
active -> disputed -> resolved
```

### Semantics
- `proposed`: written but not yet trusted for broad retrieval
- `approved`: accepted for normal retrieval
- `active`: currently valid and in default search
- `stale`: retrievable with penalty, usually hidden by fresher items
- `archived`: removed from default search, history only
- `superseded`: replaced by a successor
- `disputed`: conflict exists, awaiting resolution
- `resolved`: contradiction settled, winner marked active

---

## 13. Suggested Initial Heuristics for v1 Implementation

If the system needs a practical first version:

### Retrieval
- Search only 3-5 scopes per query, not all layers
- Exclude archived/superseded by default
- Use metadata filters before broad semantic retrieval

### Contradiction handling
- Treat identical entity + fact_type + incompatible value as a contradiction candidate
- Prefer explicit supersession; otherwise higher authority; otherwise newer verified item

### Staleness
- Session > 48h inactive => stale
- Ephemeral after task end => purge
- Project after close => archive
- Private after 90d unused => stale
- User inferred preference after 120d no reinforcement => stale

### Ranking
- Boost active project and current session hard
- Penalize raw logs when summaries exist
- Penalize memories lacking verification/confidence metadata

---

## 14. Open Questions for Future v3

- whether contradiction resolution should be fully explicit in Paperclip registries
- whether Supermemory should store canonical fact records separately from narrative memory
- whether repeated retrieval clicks/usage should feed online ranking
- whether archive recall should produce synthesized project postmortems automatically
- whether per-agent memory budgets and quotas should be enforced to reduce pollution

---

## 15. Recommended Canonical Rules

If only a few rules are implemented first, implement these:

1. **Never retrieve archived or superseded memories by default.**
2. **Project memory outranks company memory for active project work.**
3. **Governance outranks everything for rules and safety.**
4. **User-confirmed preferences outrank inferred preferences.**
5. **Curated summaries outrank raw logs.**
6. **Contradictions require explicit winner/loser metadata when detected.**
7. **Ephemeral memory must die quickly unless promoted.**
8. **Completed project memory moves to cold storage and stops polluting normal recall.**

This gives the system a sane baseline even before more advanced ranking or policy engines exist.
