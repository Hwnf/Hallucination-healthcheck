# Contradiction Example

## Scenario
A company-level standard says to use a newer framework pattern, but an active project has a local exception.

## Existing Company Memory
- company: `company_web`
- canonical rule: use modern React deployment pattern X
- status: active
- authority: company-approved

## New Project Memory
- project: `project_supermemory_fork`
- local constraint: for this project, legacy fallback Y must be used
- reason: compatibility requirement in current environment
- status: active

## Is This A True Contradiction?
Not globally.
This is a **scope-specific override**, not a total invalidation of the company rule.

## Resolution
- company rule remains active for general use
- project rule wins for local execution in the active project
- contradiction state: `coexisting`
- retrieval behavior:
  - active project work returns the project rule first
  - general best-practice lookup returns the company rule first

## Example Metadata Linkage
```json
{
  "company_memory": {
    "memory_id": "mem_company_001",
    "canonical_key": "react:deployment:pattern-x",
    "memory_scope": "company",
    "status": "active",
    "resolution_state": "coexisting"
  },
  "project_memory": {
    "memory_id": "mem_project_001",
    "canonical_key": "project_supermemory_fork:react:legacy-fallback-y",
    "memory_scope": "project",
    "status": "active",
    "resolution_state": "coexisting",
    "derived_from": ["mem_company_001"]
  }
}
```

## Key Rule
Project-specific decisions may override company defaults for local execution as long as governance does not forbid the override.
