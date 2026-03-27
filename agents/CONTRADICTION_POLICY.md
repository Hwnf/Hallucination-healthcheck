# Contradiction Policy

## Purpose
Track and resolve conflicting memories without silently overwriting history.

## Core Rule
Contradictions must be linked, resolved, and preserved through lineage metadata rather than silently deleted.

## Contradiction Definition
Two or more memories are contradictory when they assert incompatible values about the same entity/fact within overlapping time windows.

## Resolution States
- `none`
- `suspected`
- `disputed`
- `resolved`
- `superseded`
- `coexisting`

## Resolution Rules
1. explicit supersession wins
2. higher authority wins by default
3. verified beats unverified
4. more specific scope wins for local execution if governance allows
5. temporal partitioning may reconcile an apparent contradiction

## Required Fields
- `supersedes`
- `superseded_by`
- `contradiction_set`
- `resolution_state`
- `effective_from`
- `effective_until`
- `verification_state`

## Contradiction Registry Fields
- `contradiction_set_id`
- involved memory IDs
- entity key / fact key
- resolution owner
- current winner
- reason
- resolution timestamp

## Model-Facing Behavior
By default:
- provide winning memory only
- optionally note older conflicting memory if uncertainty remains

Include both sides only when:
- unresolved
- user asked for history/debugging
- materially affects output quality or safety
