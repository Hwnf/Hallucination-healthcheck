# Validation Scripts

## `validate_blueprint_v2.py`
Basic consistency checker for the Blueprint v2 file pack.

### What it checks
- required v2 docs exist
- required registry files exist
- JSON parses cleanly
- basic required fields are present
- company/project memory IDs exist in `memory_spaces.json`
- simple schema-version and duplication checks

### Run
```bash
python3 agents/scripts/validate_blueprint_v2.py
```

## Intent
This is a lightweight starter validator, not a full policy engine.
It is meant to catch drift and missing files early.
