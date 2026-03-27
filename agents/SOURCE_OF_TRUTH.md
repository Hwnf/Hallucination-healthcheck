# Source of Truth

## Purpose
Define which files are authoritative for which parts of the system, so implementation does not drift.

## Canonical Authority Map
### 1. Architecture Canon
- `BLUEPRINT_V2.md`

This is the top-level system truth.
If a lower-level file conflicts with it, the conflict must be reconciled explicitly.

### 2. Public-Safe Shareable Canon
- `BLUEPRINT_V2_PUBLIC.md`

This is for sharing externally or in lower-trust contexts.
It is a presentation layer, not the primary implementation authority.

### 3. Policy Authority
- `ACL_POLICY.md`
- `PROMOTION_RULES.md`
- `RETRIEVAL_POLICY.md`
- `LIFECYCLE_POLICY.md`
- `CLOSEOUT_PROTOCOL.md`
- `CONTRADICTION_POLICY.md`

These define actual system behavior.

### 4. Schema Authority
- `METADATA_SCHEMA_V2.json`

This governs the shape of metadata-bearing memory objects.

### 5. State Authority
Registry files in `agents/registry/` define the current configured state:
- agents
- companies
- projects
- memory spaces
- promotions
- archives
- experience index
- policies
- contradictions

### 6. Interpretation / Training Aids
Worked examples in `agents/examples/` explain how the rules should be applied.
They clarify intent, but do not override canon or policy.

### 7. Validation Authority
- `agents/scripts/validate_blueprint_v2.py`

This checks consistency, but validator success does not overrule policy canon.
It only confirms the current pack is structurally coherent.

## Conflict Rule
If two documents disagree:
1. Blueprint v2 defines architecture intent
2. policy files define operational behavior
3. schema defines shape
4. registries define current state
5. examples explain usage

When conflicts appear, update the canon and policy first, then sync registries and examples.

## Practical Rule
Do not let code invent behavior that is not represented in:
- the blueprint
- the policy docs
- the schema
- or the registries

If new behavior is needed, document it first.
