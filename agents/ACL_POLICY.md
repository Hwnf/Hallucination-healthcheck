# ACL Policy

## Goal
Define a deterministic, auditable access model for the multi-agent memory system spanning governance, company, project, restricted, private, user, session, ephemeral, and cold-storage layers.

## Core Model
Access is evaluated against:
- subject
- resource
- action
- context

Default posture: **deny unless explicitly allowed**.

## Permission Verbs
- `read`
- `write`
- `update`
- `append`
- `promote`
- `approve`
- `archive`
- `restore`
- `grant`
- `revoke`
- `audit`
- `delete`

`write` does not imply `promote`, `grant`, `archive`, or `delete`.

## Principal Classes
- **Orchestrator**: global ACL authority; only actor that can create shared spaces and finalize archive state
- **Operator / Manager**: privileged operational role; gets assigned/admin scopes, not blanket access by default
- **Agent**: limited to explicit grants plus narrow assignment inheritance
- **System service**: automated maintenance actor, always audit-logged

## Baseline Rules by Scope
### Governance
- read: orchestrator + designated operatives
- write/update/approve: orchestrator only

### Company
- read: orchestrator + explicitly assigned company members/roles
- write: orchestrator by default; others via proposal or explicit grant

### Project Shared
- read/write: assigned project agents + orchestrator
- access ends when assignment ends unless separately granted

### Restricted Shared
- no inheritance from company or project
- read/write only via explicit membership grant

### Agent Private
- read/write: owning agent
- orchestrator may inspect only for debugging, safety, compliance, reassignment, or explicit escalation

### Agent Experience
- read: orchestrator and optionally relevant specialists if granted
- write: owner/specialist and orchestrator

### User
- scoped to one user identity
- read/write only for agents actively serving that user, plus orchestrator

### Session
- bound to `conversationId`
- session access does not automatically grant durable-scope access

### Ephemeral
- temporary working context only
- no durable promotion without explicit write/promotion event

### Cold Storage
- read: orchestrator by default; operators/managers only when specifically authorized
- not included in routine retrieval

## Grant Types
- direct grant
- role grant
- assignment grant
- delegated temporary grant
- break-glass grant

Each grant should carry:
- `grant_id`
- subject
- resource
- actions
- effect
- reason
- `granted_by`
- `created_at`
- optional `expires_at`
- optional constraints

## Precedence Rules
1. hard system deny
2. explicit deny
3. break-glass allow if valid and not blocked by hard deny
4. explicit allow
5. delegated/role/assignment allow
6. inherited allow where supported
7. otherwise deny

Rules:
- deny beats allow
- break-glass does not bypass hard tenant/legal/deleted-resource protections unless explicitly allowed
- missing metadata needed for evaluation => deny and log

## Inheritance Rules
Allowed inheritance:
- project assignment -> project shared memory
- company membership -> company read where policy allows
- session participation -> session memory only

Not inherited by default:
- restricted shared
- agent private
- user memory across different users
- cold storage
- governance write/admin rights

Project closure revokes assignment-derived grants automatically.
Archived resources stop inheritance and require explicit archive-read authorization.

## Audit Requirements
Audit at minimum:
- grant created/changed/revoked
- deny/allow decision for sensitive scopes
- break-glass activation and expiry
- orchestrator access to private/user/restricted scopes
- promotion, archive, restore, delete
- failed access due to missing metadata or policy violation

## Canonical Summary
- default deny
- explicit grants over broad inheritance
- deny overrides allow
- restricted/private/user/cold scopes require explicit access
- promotion is a governed action with provenance and approval
- archive cuts off normal access
- all sensitive reads and ACL mutations are audited
