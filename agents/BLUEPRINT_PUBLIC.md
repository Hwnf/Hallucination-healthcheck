# Multi-Agent Memory Blueprint v1 (Public-Safe)

## Overview
This blueprint describes a scalable multi-agent memory architecture built around three layers:

- **OpenClaw** for agent runtime, messaging, and sessions
- **Paperclip** for organizational structure, governance, and task orchestration
- **Supermemory** for layered memory and recall

The goal is to support a growing multi-agent system with clean coordination, scoped memory access, project isolation, and long-term learning without letting shared memory become polluted.

---

## Core Design Goals

- support many agents without coordination collapse
- keep shared memory clean and useful
- separate active project context from durable organizational knowledge
- preserve valuable lessons while wiping low-value residue
- allow orchestrator-led creation of new memory spaces over time
- support additive project memory instead of overriding agent memory

---

## Memory Hierarchy

### 0. Global Governance
System-wide rules, coordination laws, permanent standards, and governance policy.

**Access**
- read: operatives and orchestrator only
- write: orchestrator only

**Examples**
- handoff protocol
- escalation rules
- memory promotion rules
- permanent coordination standards

**Example container**
- `gov_global`

### 1. Company Memory
Durable domain knowledge shared across multiple projects inside one company or specialization domain.

**Examples**
- web stack standards
- rendering pipeline conventions
- preferred tools
- reusable workflows
- domain-specific methods

**Example containers**
- `company_web`
- `company_games`

### 2. Project Shared Memory
Live collaboration memory for active projects.

**Examples**
- blockers
- decisions
- active architecture choices
- handoff status
- project constraints
- verified findings

**Example containers**
- `project_supermemory_fork`
- `project_games_prototype_alpha`

### 3. Restricted Shared Memory
Shared memory for limited groups without exposing full company scope.

**Examples**
- `restricted_billing`
- `restricted_admin`
- `restricted_render_ops`

### 4. Agent Private Memory
Local durable working memory for an individual agent.

**Examples**
- local heuristics
- unfinished patterns
- personal workflow preferences
- non-shared useful notes

**Example containers**
- `agent_orchestrator_private`
- `agent_014_private`

### 5. Agent Experience
Curated long-term specialization knowledge.

**Storage form**
- markdown files, primarily `experience.md` style files

**Examples**
- repeated bottlenecks
- durable lessons
- successful playbooks
- known failure modes

### 6. User Memory
User-specific persistent preferences and facts.

**Example container**
- `user_<id>`

### 7. Session Memory
Active thread/session continuity.

**Mechanism**
- `conversationId`

### 8. Ephemeral Context
Temporary context that usually should not become durable memory.

### 9. Cold Storage
Archived completed project memory, isolated from normal agents.

**Access**
- orchestrator
- operators/managers on command

**Not for routine agent recall.**

**Example containers**
- `archive_project_supermemory_fork`
- `archive_project_web_redesign`

---

## Access Model

### Orchestrator
Can:
- create memory spaces
- grant/revoke access
- inspect private memory if needed
- promote project learnings upward
- archive finished projects
- retrieve cold storage on command

### Operators / Managers
Can:
- access assigned company/project memories
- access cold storage when authorized
- help curate durable knowledge
- read global governance if designated as operatives

### Agents
Can:
- use private memory
- use assigned project memory
- use only explicitly granted company/restricted memory
- not access cold storage by default
- not create new shared memory spaces

---

## Write Policy

### Direct writes allowed
- own private memory
- assigned project memory if useful and non-noisy

### Proposed writes
- company memory
- restricted shared memory

### Orchestrator-only writes
- governance memory
- creation of new company/project/restricted/cold-storage spaces
- archival metadata

---

## Promotion Flow

- private -> project -> company -> governance

Promote upward only when value is proven and reusable.

---

## Project Completion Lifecycle

1. Project completes.
2. Distill bottlenecks, issues, and durable lessons.
3. Write curated lessons into the specialized agent's `experience.md`.
4. Wipe most specialized agent project memory after completion.
5. Archive project memory to cold storage.
6. Revoke routine agent access to archived project memory.
7. Carry only curated `experience.md` knowledge forward to future projects.

---

## Supermemory Metadata Schema

Use metadata with every durable memory write.

```json
{
  "agent_id": "agent_orchestrator",
  "agent_name": "Orchestrator",
  "agent_kind": "orchestrator",
  "company_id": "company_web",
  "project_id": "project_supermemory_fork",
  "memory_scope": "project",
  "visibility": "shared",
  "written_by": "agent_orchestrator",
  "source_session": "session_example",
  "channel": "discord",
  "confidence": 0.87,
  "importance": "high",
  "retention": "project_lifecycle",
  "status": "active",
  "tags": ["architecture", "memory-policy", "handoff"],
  "approved_by": "agent_orchestrator",
  "promoted_from": "agent_private",
  "timestamp": "2026-03-24T03:15:00Z"
}
```

### Suggested enum values

#### `memory_scope`
- `governance`
- `company`
- `project`
- `restricted_shared`
- `agent_private`
- `experience`
- `user`
- `session`
- `cold_storage`
- `ephemeral`

#### `visibility`
- `shared`
- `restricted`
- `private`
- `orchestrator_only`
- `operator_only`
- `manager_operator_only`

#### `retention`
- `ephemeral`
- `short_term`
- `project_lifecycle`
- `persistent`
- `archival`

#### `status`
- `proposed`
- `approved`
- `active`
- `archived`
- `stale`
- `rejected`

---

## Naming Conventions

- `gov_global`
- `company_web`
- `company_games`
- `project_supermemory_fork`
- `restricted_billing`
- `restricted_admin`
- `agent_orchestrator_private`
- `agent_001_private`
- `archive_project_supermemory_fork`
- `user_<id>`

Use `conversationId` for thread/session context.

---

## Suggested File Tree

```text
agents/
  BLUEPRINT_PUBLIC.md
  SHARED_PLAYBOOK.md
  MEMORY_POLICY.md
  ORCHESTRATOR.md

  registry/
    agents.json
    companies.json
    projects.json
    memory_spaces.json

  companies/
    _template.company.md
    web.md
    games.md

  projects/
    _template.project.md
    supermemory-fork.md

  agent-profiles/
    _template.agent.md
    orchestrator.md

  experience/
    orchestrator.md
    _template.experience.md
```

---

## Template Ideas

### Company Template
```md
# Company: <company_id>

## Mission
<what this company specializes in>

## Durable Knowledge
- stack/tooling
- standards
- workflows
- domain patterns

## What Belongs In Company Memory
- reusable methods
- domain standards
- stable tool preferences

## What Stays Out
- raw project chatter
- private agent notes
- one-off noise

## Access
- who can read
- who can write
- who can approve promotions
```

### Project Template
```md
# Project: <project_id>

## Objective
<goal>

## Company
<company_id>

## Assigned Agents
- <agent_ids>

## Allowed Memory
- project shared memory
- relevant company memory
- agent private memory

## Deliverables
- <deliverables>

## Completion Rules
- archive to cold storage
- extract valuable lessons to specialist experience.md
- wipe most specialized project memory after completion
- revoke unnecessary access
```

### Agent Profile Template
```md
# Agent Profile: <agent_id>

## Name
<display name>

## Mission
<current purpose>

## Tone
<tone>

## Permissions
- tools:
- memory reads:
- memory writes:
- escalation rights:

## Memory Behavior
- what to write
- what to avoid
- when to escalate instead of writing

## Handoff Style
<how this agent communicates state>

## Constraints
<what this agent must never do>
```

### Experience Template
```md
# Experience: <agent_id or specialization>

## Durable Lessons
- lesson:
  context:
  signal:
  action:

## Bottlenecks Seen Repeatedly
- <pattern>

## What Works
- <best practices>

## What Fails
- <anti-patterns>

## Promotion Candidates
- lessons that may deserve company-level memory
```

---

## Practical Stack Recommendation

- **Paperclip** = org/company/task/governance layer
- **Supermemory** = layered memory and recall layer
- **OpenClaw** = runtime/session/messaging layer

This gives a clean separation of concerns instead of forcing one system to do everything.

---

## Recommended Build Order

1. create the file tree
2. create templates
3. create initial registries
4. define first company (`company_web`)
5. define first project (`project_supermemory_fork`)
6. define orchestrator profile
7. define memory write rules in `MEMORY_POLICY.md`
8. wire Supermemory naming and metadata conventions
9. add more agents only after the foundation is stable
