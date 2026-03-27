# Engineering MVP Brief

## Purpose
Translate Blueprint v2 into the smallest production-safe implementation subset.

## Principle
**Ship policy enforcement before intelligence polish.**

Implement first:
- ACL enforcement
- retrieval filters
- core metadata
- promotion logging/workflow
- mandatory closeout
- cold-storage isolation

Keep simple/manual at v1:
- contradiction resolution
- scoring/ranking calibration
- experience extraction
- archive packaging polish
- advanced automation

## MVP Deliverables
### 1. ACL Engine
- deny by default
- explicit grants
- no default inheritance for restricted/private/user/cold
- audit sensitive reads and ACL changes

### 2. Retrieval Gate
- scope-before-similarity routing
- hard filters for ACL, scope IDs, status, effective time window
- archived and superseded excluded by default

### 3. Core Metadata
Minimum required fields:
- `schema_version`
- `memory_id`
- `canonical_key`
- `memory_scope`
- `visibility`
- `sensitivity`
- `status`
- `confidence`
- `verification_state`
- `written_by`
- `approved_by`
- `promoted_from`
- `promotion_state`
- `derived_from`
- `supersedes`
- `superseded_by`
- `contradiction_set`
- `company_id`
- `project_id`
- `user_id`
- `conversation_id`
- `effective_from`
- `effective_until`
- `ttl`
- `expires_at`
- `timestamp`

### 4. Promotion Workflow
- propose
- review/approve manually
- store promotion metadata
- enforce no raw transcripts/debug spam/speculative unlabeled claims

### 5. Project Closeout Workflow
- freeze project memory
- distill summary + lessons
- create archive package
- revoke/reduce access
- remove archived project memory from default retrieval
- preserve extracted experience

### 6. Cold Storage Access
- manual and authorized only
- excluded from default retrieval
- callable for precedent lookups only

## Decision Line For Engineering
If a feature does not improve one of these three things, it should probably wait:
- who can see/write memory
- what memory gets retrieved by default
- how project memory stops contaminating future work

## Canon Relationship
- **Blueprint v2** remains the canon
- this MVP brief is the production-filtered implementation subset
