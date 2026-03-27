# Retrieval Policy

## Purpose
Define how the system selects memory layers, ranks results, suppresses stale/noisy context, and handles contradictions.

## Core Principles
1. Scope before similarity.
2. Freshness matters, but truth matters more.
3. Resolved contradictions must not keep resurfacing.
4. Project chatter should decay aggressively.
5. Durable knowledge must be curated.
6. Retrieval only considers memory visible under ACL.

## Default Retrieval Order by Scenario
### A. Active project execution
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
1. governance
2. restricted
3. company
4. project

### C. User personalization
1. user
2. session
3. project if task-specific

### D. “How did we solve this before?”
1. project
2. experience
3. company
4. cold storage

### E. Self-improvement / agent operations
1. private
2. experience
3. project/company as relevant

## Hard Filters Before Ranking
- ACL visibility
- relevant company/project/user/session IDs
- allowed statuses: default `active`, optionally `approved`
- `effective_from <= now`
- `effective_until` absent or in future
- exclude `archived` unless archive mode enabled
- exclude `superseded` by default unless history/debug mode

## Ranking Model
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

## Canonical Ranking Rules
1. Never retrieve archived or superseded memories by default.
2. Project memory outranks company memory for active project work.
3. Governance outranks everything for rules and safety.
4. User-confirmed preferences outrank inferred preferences.
5. Curated summaries outrank raw logs.
6. Contradictions require explicit winner/loser metadata when detected.
7. Ephemeral memory must die quickly unless promoted.
8. Completed project memory moves to cold storage and stops polluting normal recall.

## Scope Budgets
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

## Contradiction Handling
### Resolution Rules
- explicit supersession wins
- higher authority wins by default
- verified beats unverified
- more specific scope wins for local execution if governance allows
- temporal partitioning can reconcile apparent conflicts

### Resolution States
- `none`
- `suspected`
- `disputed`
- `resolved`
- `superseded`
- `coexisting`

### Model-facing behavior
By default, provide the winning memory only.
Include both sides only when:
- contradiction unresolved
- user asks for history/debugging
- decision materially affects quality or safety

## Write-Time Rules That Improve Retrieval
1. One fact/decision per item when possible.
2. Explicit entity names and IDs.
3. Set effective time windows when facts change.
4. Use `supersedes` on updates.
5. Mark uncertainty explicitly.
6. Prefer curated summaries for large discussions.
7. Attach ACL tags at write time.
8. Avoid storing chain-of-thought or speculative filler as durable memory.
