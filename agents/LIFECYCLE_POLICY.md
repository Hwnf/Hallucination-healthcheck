# Lifecycle Policy

## Purpose
Define how memory ages, decays, gets reviewed, archives, or is purged.

## Core Principle
Active memory should be useful now. Historical memory should not pollute routine retrieval.

## Lifecycle State Machine
```text
proposed -> approved -> active -> stale -> archived
                \-> rejected
active -> superseded
active -> disputed -> resolved
```

## Semantics
- `proposed`: written but not trusted for broad retrieval
- `approved`: accepted for normal retrieval
- `active`: currently valid and in default search
- `stale`: retrievable with penalty, usually hidden by fresher items
- `archived`: removed from default search, history only
- `superseded`: replaced by a successor
- `disputed`: conflict exists, awaiting resolution
- `resolved`: contradiction settled, winner marked active

## TTL / Review Defaults by Scope
### Governance
- retention: persistent
- TTL: none
- review every 90–180 days

### Company
- retention: persistent
- review every 60–120 days
- archive/supersede outdated standards, do not silently delete

### Project
- retention: project lifecycle
- soft stale threshold: 14 days inactive
- archive on completion, cancellation, or 30 days inactive by default

### Restricted Shared
- retention: persistent or project-bound
- review every 30–90 days

### Agent Private
- retention: medium-term persistent
- soft stale threshold: 30 days since last use/update
- purge threshold: 90–180 days for low-value notes unless pinned or promoted

### Agent Experience
- retention: persistent curated
- review every 60–120 days

### User
- stable facts: no TTL, periodic verification
- preferences: review every 90–180 days
- transient circumstances: 7–30 days unless reaffirmed

### Session
- active conversation duration + 24–72h grace
- stale after >24h inactivity

### Ephemeral
- minutes to current task duration
- purge after task completion unless promoted

### Cold Storage
- archival
- not retrieved by default
- only historical unless revalidated

## Stale Criteria
A memory becomes stale when:
- older than expected review window without re-verification
- tied to a completed project lifecycle
- references obsolete tooling/versioning
- repeatedly outranked by newer canonical summaries
- represents closed task-state memory
- user preference is not observed/reaffirmed over time

## Deletion / Purge Rules
Delete or purge if:
- ephemeral expires
- duplicate confirmed and merged
- private note expires without promotion
- user-requested deletion applies

Archive instead of delete if:
- project completed
- audit relevance exists
- future precedent value is likely

## Cold Storage Rule
Cold storage is for:
- precedent lookup
- audits
- postmortems
- resurrection of paused projects

It is not for routine context stuffing into active agents.
