#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace/agents')
REG = ROOT / 'registry'

required_files = [
    ROOT / 'BLUEPRINT_V2.md',
    ROOT / 'ACL_POLICY.md',
    ROOT / 'PROMOTION_RULES.md',
    ROOT / 'RETRIEVAL_POLICY.md',
    ROOT / 'LIFECYCLE_POLICY.md',
    ROOT / 'CLOSEOUT_PROTOCOL.md',
    ROOT / 'CONTRADICTION_POLICY.md',
    ROOT / 'METADATA_SCHEMA_V2.json',
    REG / 'agents.json',
    REG / 'companies.json',
    REG / 'projects.json',
    REG / 'memory_spaces.json',
    REG / 'promotions.json',
    REG / 'archives.json',
    REG / 'experience_index.json',
    REG / 'policies.json',
    REG / 'contradictions.json',
]

errors = []
notes = []

for f in required_files:
    if not f.exists():
        errors.append(f'Missing required file: {f}')


def load_json(path):
    try:
        return json.loads(path.read_text())
    except Exception as e:
        errors.append(f'Invalid JSON in {path}: {e}')
        return None

if not errors:
    agents = load_json(REG / 'agents.json')
    companies = load_json(REG / 'companies.json')
    projects = load_json(REG / 'projects.json')
    memory_spaces = load_json(REG / 'memory_spaces.json')
    promotions = load_json(REG / 'promotions.json')
    archives = load_json(REG / 'archives.json')
    experience_index = load_json(REG / 'experience_index.json')
    policies = load_json(REG / 'policies.json')
    contradictions = load_json(REG / 'contradictions.json')

    if agents is not None:
        for a in agents:
            for key in ['agent_id', 'status', 'schema_version']:
                if key not in a:
                    errors.append(f"Agent missing '{key}': {a}")
            if a.get('schema_version') != '2.0':
                errors.append(f"Agent {a.get('agent_id')} is not schema_version 2.0")

    if companies is not None:
        for c in companies:
            for key in ['company_id', 'memory_id', 'schema_version']:
                if key not in c:
                    errors.append(f"Company missing '{key}': {c}")

    if projects is not None:
        for p in projects:
            for key in ['project_id', 'company_id', 'memory_id', 'schema_version']:
                if key not in p:
                    errors.append(f"Project missing '{key}': {p}")
            if 'closeout_policy' not in p:
                notes.append(f"Project {p.get('project_id')} has no closeout_policy")

    if memory_spaces is not None:
        mem_ids = set()
        for m in memory_spaces:
            for key in ['memory_id', 'scope', 'schema_version']:
                if key not in m:
                    errors.append(f"Memory space missing '{key}': {m}")
            mem_id = m.get('memory_id')
            if mem_id in mem_ids:
                errors.append(f'Duplicate memory_id in memory_spaces.json: {mem_id}')
            mem_ids.add(mem_id)

        if projects is not None:
            for p in projects:
                if p.get('memory_id') not in mem_ids:
                    errors.append(f"Project memory_id missing from memory_spaces: {p.get('memory_id')}")
                if p.get('archive_memory_id') not in mem_ids:
                    notes.append(f"Archive memory_id not present yet in memory_spaces: {p.get('archive_memory_id')}")

        if companies is not None:
            for c in companies:
                if c.get('memory_id') not in mem_ids:
                    errors.append(f"Company memory_id missing from memory_spaces: {c.get('memory_id')}")

    if promotions is not None:
        for p in promotions:
            for key in ['promotion_id', 'from_memory_id', 'to_memory_id', 'status']:
                if key not in p:
                    errors.append(f"Promotion missing '{key}': {p}")

    if archives is not None:
        for a in archives:
            for key in ['archive_id', 'project_id', 'archive_memory_id', 'status']:
                if key not in a:
                    errors.append(f"Archive missing '{key}': {a}")

    if experience_index is not None:
        for e in experience_index:
            for key in ['experience_owner', 'file']:
                if key not in e:
                    errors.append(f"Experience index missing '{key}': {e}")

    if policies is not None:
        for p in policies:
            for key in ['policy_id', 'file', 'status', 'schema_version']:
                if key not in p:
                    errors.append(f"Policy entry missing '{key}': {p}")

    if contradictions is not None and not isinstance(contradictions, list):
        errors.append('contradictions.json must be a JSON array')

print('Blueprint V2 validation report')
print('=' * 32)
if errors:
    print('\nErrors:')
    for e in errors:
        print(f'- {e}')
else:
    print('\nErrors: none')

if notes:
    print('\nNotes:')
    for n in notes:
        print(f'- {n}')
else:
    print('\nNotes: none')

raise SystemExit(1 if errors else 0)
