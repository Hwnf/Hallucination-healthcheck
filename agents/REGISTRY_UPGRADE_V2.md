# Registry Upgrade Pass (V2)

## Purpose
This note records the registry upgrade from Blueprint v1 to Blueprint v2.

## What was added
- v2 fields to `agents.json`
- v2 fields to `companies.json`
- v2 fields to `projects.json`
- v2 fields to `memory_spaces.json`
- new registries:
  - `promotions.json`
  - `archives.json`
  - `experience_index.json`

## What changed conceptually
- registries now reflect lifecycle state, review/promotion policies, and archive behavior
- memory spaces now carry explicit retrieval/review/archive policy fields
- projects now carry closeout-specific fields
- agents now carry grant objects and escalation metadata

## Next likely upgrades
- add `acl_grants.json` or equivalent if grants move out of `agents.json`
- add contradiction registry
- add automated archive manifest generation
- add policy registry if dynamic policy loading becomes useful
