# Hallucination Health Check

**A deterministic-first verification harness that proves tool use and evidence binding, then emits observability-tier-aware verdicts.**

V3.1 — Receipt Checker / Future-Resilient Scope

## What This Is

A CLI tool that verifies whether an AI agent actually did what it claimed to do. If the agent says "I searched," "I ran the test," or "I verified the result," this harness checks whether the transcript and runtime evidence support that claim.

It is **not** a generic hallucination scorer. It is a receipt checker for agent workflows.

## Hard Rules

1. **Agent narration is not proof.** Claims must bind to visible evidence.
2. **The target agent does not get to rebut the harness.** Judgment from evidence, not conversation.
3. **Deterministic findings outrank semantic findings.** Semantic calls classify, never certify.
4. **Must expose what it cannot know.** Insufficient evidence or unverifiable — never fake confidence.
5. **The semantic layer is a bounded helper, not the judge.**
6. **Drift is in scope.** Correct tool use does not rescue a drifted answer.

## Verdict Taxonomy

| Verdict | Meaning |
|---------|---------|
| **Verified** | Claim supported by visible evidence at current tier |
| **Unsupported** | No supporting evidence found |
| **Contradicted** | Evidence conflicts with the claim |
| **Insufficient evidence** | Too sparse to decide |
| **Unverifiable at tier** | Current observability tier cannot access needed evidence |
| **Policy violation** | Required step skipped or rule violated |

## Quick Start

```bash
# Generate benchmark traces
cd hhc
python datasets/generate_traces.py

# Run a single check
python -m apps.cli check datasets/seeded/tb_01_fake_search.json

# Run full benchmark
python -m apps.cli benchmark datasets/
```

## Project Structure

```
hhc/
├── apps/
│   └── cli.py                          # CLI entry point
├── packages/
│   ├── schemas/models.py               # Canonical trace + verdict schemas
│   ├── parser/trace_loader.py          # JSON trace → Trace object
│   ├── deterministic_checks/checks.py  # Stage 2: all deterministic checks
│   ├── adjudicator/engine.py           # Tier-aware verdict assembly
│   ├── adapters/base.py                # Provider-agnostic semantic adapter
│   ├── semantic_calls/                 # Stage 3: bounded LLM calls (Phase 1b)
│   ├── telemetry/                      # OTel ingestion (Phase 1c)
│   └── evals/benchmark.py             # Benchmark runner + metrics
├── datasets/
│   ├── seeded/                         # Hallucinated traces (labeled)
│   ├── clean/                          # Clean traces (no hallucinations)
│   └── generate_traces.py             # Trace generator script
├── prompts/                            # Semantic call system prompts (Phase 1b)
└── docs/                               # Documentation
```

## Phase Status

- [x] **Phase 0**: Schema freeze, repo skeleton
- [x] **Phase 1**: Ground-truth benchmark (20 traces)
- [x] **Phase 2**: Deterministic CLI auditor
- [ ] **Phase 3**: Evidence-binding layer (semantic calls)
- [ ] **Phase 4**: Tier-aware adjudicator enhancements
- [ ] **Phase 5**: Runtime proof binder (OTel)
- [ ] **Phase 6**: Upgrade-safe eval harness

## Quality Gates

| Phase | Metric | Target |
|-------|--------|--------|
| P2 | False positive rate on clean traces | < 5% |
| P2 | Tool bypass / citation detection | > 95% |
| P3 | Unsupported-claim recall | ≥ 85% |
| P3 | End-to-end false positive rate | < 10% |
| P3 | p95 latency (40k tokens) | < 2s |

## Dependencies

Python 3.12+ (stdlib only for Phase 1a — no external dependencies required)
```
