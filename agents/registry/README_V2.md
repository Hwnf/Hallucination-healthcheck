# Registry V2 Notes

This directory contains the v2 operational registries for the multi-agent memory system.

## Core registries
- `agents.json` — agent principals, capabilities, grants, escalation rights
- `companies.json` — company/domain definitions and default memory policies
- `projects.json` — active project records, lifecycle state, closeout policy
- `memory_spaces.json` — memory containers/spaces and their operational policies

## Additional v2 registries
- `promotions.json` — records of upward promotions and approvals
- `archives.json` — project archive records and closeout bundles
- `experience_index.json` — mapping of experience owners/files/lesson keys

## Intent
These registries bridge the blueprint docs with actual implementation state.
They should evolve alongside ACL, retrieval, lifecycle, and closeout policy.
