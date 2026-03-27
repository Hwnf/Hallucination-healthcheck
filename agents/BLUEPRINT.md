# Multi-Agent Memory Blueprint v1

## Core Goal
Build a scalable multi-agent memory architecture for OpenClaw using Supermemory as the memory/context layer, Paperclip as the organizational/orchestration layer, and OpenClaw as the runtime/session layer.

## Platform Roles
- **OpenClaw**: agent runtime, messaging, sessions
- **Paperclip**: organizational structure, governance, tasks, companies
- **Supermemory**: layered memory and recall

## Memory Hierarchy

### 0. Global Governance
**Purpose:** System-wide rules, governance, coordination laws, permanent standards.

**Access:**
- read: operatives and orchestrator only
- write: orchestrator only

**Examples:**
- handoff protocol
- escalation rules
- write/promotion policy
- permanent coordination standards

**Container:** `gov_global`

### 1. Company Memory
**Purpose:** Durable company/domain knowledge shared across projects in that company.

**Examples:**
- website company stack standards
- game company rendering pipeline
- preferred tools
- reusable workflows
- domain-specific methods

**Container examples:**
- `company_web`
- `company_games`

### 2. Project Shared Memory
**Purpose:** Live collaboration memory for active projects.

**Examples:**
- blockers
- decisions
- active architecture choices
- handoff status
- project constraints
- verified findings

**Container examples:**
- `project_supermemory_fork`
- `project_games_prototype_alpha`

### 3. Restricted Shared Memory
**Purpose:** Shared memory for limited groups without exposing full company scope.

**Examples:**
- `restricted_billing`
- `restricted_admin`
- `restricted_render_ops`

### 4. Agent Private Memory
**Purpose:** Local durable working memory for the individual agent.

**Examples:**
- local heuristics
- unfinished patterns
- personal workflow preferences
- non-shared useful notes

**Container examples:**
- `agent_orchestrator_private`
- `agent_014_private`

### 5. Agent Experience
**Purpose:** Curated long-term specialization knowledge.

**Storage form:** Markdown files, primarily `experience.md` files.

**Examples:**
- repeated bottlenecks
- durable lessons
- successful playbooks
- known failure modes

### 6. User Memory
**Purpose:** User-specific persistent preferences and facts.

**Container example:** `user_<id>`

### 7. Session Memory
**Purpose:** Active thread/session continuity.

**Mechanism:** `conversationId`

### 8. Ephemeral
**Purpose:** Temporary context that should usually never become durable memory.

### 9. Cold Storage
**Purpose:** Archived completed project memory, isolated from normal agents.

**Access:**
- orchestrator
- operators/managers on command

**Not for routine agent recall.**

**Container examples:**
- `archive_project_supermemory_fork`
- `archive_project_web_redesign`

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

## Promotion Flow
- private -> project -> company -> governance

Promote upward only when value is proven and reusable.

## Project Completion Lifecycle
1. Project completes.
2. Distill bottlenecks, issues, and durable lessons.
3. Write curated lessons into the specialized agent's `experience.md`.
4. Wipe most specialized agent project memory after completion.
5. Archive project memory to cold storage.
6. Revoke routine agent access to archived project memory.
7. Carry only curated `experience.md` knowledge forward to future projects.

## Metadata Schema for Supermemory

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
  "source_session": "discord_1485839353149391020",
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

### Suggested Enum Values

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

## Workspace File Tree

```text
agents/
  BLUEPRINT.md
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

## Templates

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

## Registry Examples

### agents.json
```json
[
  {
    "agent_id": "agent_orchestrator",
    "display_name": "Orchestrator",
    "status": "active",
    "capabilities": ["coordination", "routing", "memory-governance"],
    "assigned_projects": ["project_supermemory_fork"],
    "private_memory_id": "agent_orchestrator_private",
    "experience_file": "agents/experience/orchestrator.md",
    "memory_permissions": {
      "read": ["gov_global", "company_web", "project_supermemory_fork"],
      "write": ["agent_orchestrator_private", "project_supermemory_fork", "gov_global"],
      "admin": true
    }
  }
]
```

### companies.json
```json
[
  {
    "company_id": "company_web",
    "name": "Web Company",
    "status": "active",
    "memory_id": "company_web",
    "projects": ["project_supermemory_fork"],
    "description": "Website and software delivery company"
  },
  {
    "company_id": "company_games",
    "name": "Games Company",
    "status": "planned",
    "memory_id": "company_games",
    "projects": [],
    "description": "Game, art, rendering, and asset pipeline company"
  }
]
```

### projects.json
```json
[
  {
    "project_id": "project_supermemory_fork",
    "company_id": "company_web",
    "status": "active",
    "memory_id": "project_supermemory_fork",
    "archive_memory_id": "archive_project_supermemory_fork",
    "assigned_agents": ["agent_orchestrator"],
    "completion_policy": {
      "archive_on_close": true,
      "extract_experience": true,
      "wipe_specialized_memory": true,
      "cold_storage_access": ["agent_orchestrator", "operators", "managers"]
    }
  }
]
```

### memory_spaces.json
```json
[
  {
    "memory_id": "gov_global",
    "scope": "governance",
    "status": "active",
    "readers": ["agent_orchestrator", "operatives"],
    "writers": ["agent_orchestrator"],
    "retention": "persistent"
  },
  {
    "memory_id": "company_web",
    "scope": "company",
    "status": "active",
    "readers": ["agent_orchestrator"],
    "writers": ["agent_orchestrator"],
    "retention": "persistent"
  },
  {
    "memory_id": "project_supermemory_fork",
    "scope": "project",
    "status": "active",
    "readers": ["agent_orchestrator"],
    "writers": ["agent_orchestrator"],
    "retention": "project_lifecycle"
  },
  {
    "memory_id": "archive_project_supermemory_fork",
    "scope": "cold_storage",
    "status": "inactive",
    "readers": ["agent_orchestrator", "operators", "managers"],
    "writers": ["agent_orchestrator"],
    "retention": "archival"
  }
]
```
