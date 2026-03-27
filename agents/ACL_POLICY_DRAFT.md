# ACL / Access-Control Policy Draft

## Goal
Define a deterministic, auditable access model for the multi-agent memory system spanning governance, company, project, restricted, private, user, session, ephemeral, and cold-storage layers.

## 1) Core Model
Access is evaluated against four things:
- **subject**: agent, orchestrator, operator/manager, or system process
- **resource**: memory space/container or individual memory record
- **action**: `read`, `write`, `promote`, `approve`, `grant`, `revoke`, `archive`, `restore`, `delete`
- **context**: company, project, session, user, active assignment, emergency override state

Default posture: **deny unless explicitly allowed**.

## 2) Permission Types
Use the following permission verbs:
- `read`: retrieve/search/view memory
- `write`: create new memory in an allowed scope
- `update`: modify existing memory metadata/content in-place
- `append`: add notes/events without rewriting prior record
- `promote`: copy/distill memory upward across scopes
- `approve`: mark proposed memory as approved/active
- `archive`: move memory into cold storage
- `restore`: temporarily re-open archived memory
- `grant`: issue ACL grants on a resource
- `revoke`: remove ACL grants on a resource
- `audit`: inspect access history and ACL history
- `delete`: hard-delete; should be rare and usually orchestrator-only

`write` does not imply `promote`, `grant`, `archive`, or `delete`.

## 3) Principal Classes
- **Orchestrator**: global ACL authority; may inspect all scopes when required; only actor that can create shared spaces and finalize archive state.
- **Operator / Manager**: human-supervised or privileged operational role; gets only assigned/admin scopes, not blanket access by default.
- **Agent**: normal execution principal; limited to explicit grants plus narrow inheritance from assignments.
- **System service**: automated maintenance actions; must act as a named service principal and be audit-logged.

## 4) Scope Baseline Rules
### Governance (`gov_global`)
- Read: orchestrator, explicitly designated operatives
- Write/update/approve: orchestrator only
- Grant/revoke: orchestrator only

### Company
- Read: orchestrator + explicitly assigned company members/roles
- Write: orchestrator by default; others via proposed-write or explicit grant
- Promote into company: requires `promote` + `approve`

### Project Shared
- Read/write: assigned project agents and orchestrator
- Promote upward: not automatic; requires policy check and approval
- Access ends when project assignment ends, unless separately granted

### Restricted Shared
- No inheritance from company or project by default
- Read/write only via explicit membership grant
- Used for need-to-know collaboration groups

### Agent Private
- Read/write/update: owning agent
- Orchestrator may inspect only for debugging, safety, compliance, reassignment, or explicit escalation
- Private memory is not promotable by non-owner unless escalated or approved by orchestrator

### Agent Experience
- Read: orchestrator and optionally same-specialization agents if granted
- Write: owner/specialist and orchestrator
- Promotion to company/governance requires approval

### User
- Scoped to a specific user identity
- Read/write only for agents actively serving that user, plus orchestrator
- Cross-user access is denied unless explicit admin/legal override exists

### Session
- Bound to `conversationId` or equivalent thread/session identifier
- Read/write for principals participating in that session
- Session access does not automatically grant durable-scope access

### Ephemeral
- Temporary working context only
- No durable promotion without explicit write/promotion event
- Expiry should be automatic

### Cold Storage
- Read: orchestrator by default; operators/managers only when specifically authorized
- Write/archive/finalize: orchestrator only
- Not included in routine retrieval for standard agents

## 5) Grant Types
Support these grant forms:
- **Direct grant**: principal -> resource -> actions
- **Role grant**: role -> resource -> actions
- **Assignment grant**: derived from active project/company/user assignment
- **Delegated grant**: temporary grant issued by orchestrator/admin with expiry
- **Break-glass grant**: emergency override; time-limited, high-audit, justification required

Each grant should carry:
- `grant_id`
- `subject_type` / `subject_id`
- `resource_id` or resource selector
- `actions`
- `effect`: `allow` or `deny`
- `reason`
- `granted_by`
- `created_at`
- optional `expires_at`
- optional `constraints` (project, user, session, tag filters, time window)

## 6) Precedence Rules
Evaluation order should be deterministic:
1. **Hard system deny** (illegal scope crossing, archived lock, tenant/user isolation, deleted resource)
2. **Explicit deny** on subject/resource/action
3. **Break-glass allow** if valid and not blocked by hard system deny
4. **Explicit allow** direct to principal
5. **Delegated/role/assignment allow**
6. **Inherited allow** from parent scope, if that scope supports inheritance
7. Otherwise **deny**

Rules:
- **Deny beats allow** except where a valid break-glass override is explicitly defined to bypass normal denies.
- Break-glass must **not** bypass hard tenant, legal, or deleted-resource protections unless policy explicitly says so.
- Missing metadata needed for evaluation => deny and log policy failure.

## 7) Inheritance Rules
Inheritance should be narrow, not broad.

Allowed inheritance:
- Project assignment may inherit read/write to that project shared memory
- Company membership may inherit read to company memory if policy allows
- Session participation may inherit session-memory access only

Not inherited by default:
- Restricted shared
- Agent private
- User memory across different users
- Cold storage
- Governance write/admin rights

Parent/child behavior:
- Parent allow does **not** automatically grant child restricted spaces
- Child deny does not remove parent access elsewhere; it only blocks that child resource
- Project closure revokes assignment-derived grants automatically
- Archived resources stop inheritance and require explicit archive-read authorization

## 8) Write / Promotion Semantics
- A subject may only write into a scope it can already `write`.
- Up-scope movement is a **promotion**, not a normal write.
- Promotion requires provenance metadata: source scope, source record(s), promoter, approval state, confidence.
- Suggested default:
  - agent private -> project: owner or orchestrator may propose; project-writer/orchestrator approves
  - project -> company: orchestrator or designated curator approves
  - company -> governance: orchestrator only
- Promotion should create a new record with lineage, not silently mutate the source into a different scope.

## 9) Audit Requirements
Every ACL decision and mutation should be auditable.

Minimum audit events:
- grant created/changed/revoked
- deny/allow decision for sensitive scopes
- break-glass activation and expiry
- orchestrator access to agent private/user/restricted scopes
- promotion, archive, restore, delete
- failed access due to missing metadata or policy violation

Audit fields:
- `event_id`
- `timestamp`
- `actor_id`
- `actor_role`
- `action`
- `resource_id`
- `resource_scope`
- `decision` or mutation result
- `reason` / justification
- `source_ip/session_id` if applicable
- `correlation_id` / task id

Audit logs should be append-only and retained longer than normal project memory.

## 10) Required Metadata for Resources
Each resource/record should expose enough ACL metadata to evaluate access:
- `memory_id`
- `memory_scope`
- `company_id` if applicable
- `project_id` if applicable
- `user_id` if applicable
- `owner_agent_id` if private/experience
- `visibility`
- `status` (`proposed`, `active`, `archived`, etc.)
- `retention`
- `acl_inherit` (boolean or inheritance mode)
- `acl_tags` / restrictions if needed

## 11) Edge Cases
- **Archived project reopened**: restore only with explicit `restore`; previous assignment grants are not automatically resurrected unless policy says so.
- **Agent reassignment**: project access follows current assignment; private memory stays with original owner unless explicitly transferred.
- **Agent retirement/deletion**: private memory becomes orchestrator-controlled; experience may be retained under service ownership.
- **Cross-company project**: create explicit multi-company project grants; do not infer company-wide access both ways.
- **Restricted subset inside project**: use separate restricted memory; project membership alone is insufficient.
- **Conflicting grants**: explicit deny wins over role/assignment allow.
- **Stale grants**: expired grants are ignored, then logged if used.
- **Missing lineage on promoted memory**: treat as unapproved/proposed or reject.
- **User data in shared scopes**: either redact, store pointer/reference, or require explicit user-scope approval before promotion.
- **Emergency debugging of private memory**: allowed only via orchestrator or break-glass with justification and audit trail.

## 12) Recommended Implementation Shape
Store ACL separately from content but resolvable at read time:
- resource registry (`memory_spaces.json` or equivalent)
- grant registry (`acl_grants.json` or DB table)
- append-only audit log (`acl_audit.jsonl` or DB table)

Decision function should be pure and explainable:
`can(subject, action, resource, context) -> {allow: bool, rule_id, reason}`

## 13) Short Policy Summary
- Default deny
- Explicit grants over broad inheritance
- Deny overrides allow
- Restricted/private/user/cold scopes require explicit access
- Promotion is a governed action with provenance and approval
- Archive cuts off normal access
- All sensitive reads and all ACL mutations are audited
- Orchestrator is the global authority, but even orchestrator access should be logged