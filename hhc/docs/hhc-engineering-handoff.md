# HALLUCINATION HEALTH CHECK — COMPLETE ENGINEERING HANDOFF

## For: Claude Code Agent
## Date: March 2026
## Status: Phase 1a complete, Phase 1b partial, Phases 1c–3 not started

---

## SECTION 1: WHAT THIS PROJECT IS

A deterministic-first CLI verification pipeline for AI agent workflows. It checks whether an agent actually did what it claimed — searched, executed, tested, verified — by comparing claims against transcript evidence, tool call logs, and runtime artifacts. It returns a structured verdict with six possible outcomes: verified, unsupported, contradicted, insufficient evidence, unverifiable at current tier, or policy violation.

It is NOT an agent. It is NOT a chatbot. It is a fixed pipeline that reads evidence and renders judgment. The target agent never gets to explain itself.

### Core Rules (never break these)
1. Agent narration is not proof. Claims must bind to visible evidence.
2. The target agent does not get to rebut the harness.
3. Deterministic findings outrank semantic findings.
4. Must expose what it cannot know — never fake confidence.
5. The semantic layer is a bounded helper, not the judge.
6. Drift is in scope. Correct tool use does not rescue a drifted answer.

---

## SECTION 2: CURRENT STATE OF THE CODEBASE

### Repository Structure
```
hhc/
├── apps/
│   ├── __init__.py
│   ├── cli.py                              # CLI entry point (190 lines) — DONE
│   └── api.py                              # FastAPI wrapper (272 lines) — WRITTEN, UNTESTED
├── packages/
│   ├── __init__.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── models.py                       # All data models (342 lines) — DONE
│   ├── parser/
│   │   ├── __init__.py
│   │   └── trace_loader.py                 # JSON → Trace (123 lines) — DONE
│   ├── deterministic_checks/
│   │   ├── __init__.py
│   │   └── checks.py                       # 6 deterministic checks (477 lines) — DONE
│   ├── semantic_calls/
│   │   ├── __init__.py
│   │   ├── orchestrator.py                 # Local heuristic implementations (514 lines) — DONE
│   │   └── router.py                       # Adapter-aware router (280 lines) — DONE
│   ├── adjudicator/
│   │   ├── __init__.py
│   │   └── engine.py                       # Tier-aware verdict assembly (222 lines) — DONE
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── base.py                         # Abstract adapter interface (226 lines) — DONE
│   │   └── gemini.py                       # Gemini implementation (514 lines) — WRITTEN, UNTESTED
│   ├── telemetry/
│   │   └── __init__.py                     # EMPTY — Phase 1c
│   └── evals/
│       ├── __init__.py
│       └── benchmark.py                    # Benchmark runner (311 lines) — DONE
├── datasets/
│   ├── seeded/                             # 34 hallucinated traces — DONE
│   ├── clean/                              # 17 clean traces — DONE
│   ├── generate_traces.py                  # First 18 traces generator — DONE
│   └── generate_traces_v2.py              # Additional traces generator — DONE
├── prompts/
│   └── system_prompts.py                   # All 5 system prompts (185 lines) — DONE
├── docs/
└── README.md                               # Project README — DONE
```

Total: 4,904 lines Python, 51 benchmark traces, 0 external dependencies (stdlib only for Phase 1a).

### Current Benchmark Results (deterministic only)
```
Precision:        85.7%
Recall:           52.9%
FP rate (clean):  0.0%

By Category:
  tool_bypass:          8/8   (100%) — PASS
  citation_fabrication: 4/4   (100%) — PASS
  capability_overclaim: 4/5   (80%)
  contradiction:        2/9   (22%)  — needs semantic layer
  context_drift:        0/4   (0%)   — needs semantic layer
  unsupported_claim:    0/4   (0%)   — needs semantic layer
```

The 52.9% recall gap is entirely from categories that require language understanding (contradictions, drift, unsupported claims). The deterministic layer catches everything it can. The semantic layer (LLM calls) is built as local heuristics and needs to be connected to a real LLM provider.

---

## SECTION 3: VERDICT TAXONOMY

Every verdict report must use exactly these six verdicts:

| Verdict | Meaning | Typical Trigger |
|---------|---------|-----------------|
| `verified` | Claim supported by visible evidence at current tier | Tool call + output matches the claim |
| `unsupported` | Expected evidence not found | Agent says "I searched" but no search tool call exists |
| `contradicted` | Evidence conflicts with claim | Tool says "FAILED" but agent says "passed" |
| `insufficient_evidence` | Too sparse to decide | Weak reference with no hard contradiction |
| `unverifiable_at_tier` | Current tier cannot access needed evidence | Tier 3 review of an execution claim |
| `policy_violation` | Required step skipped or rule violated | Current-events answer with no search tool |

Rule: A Tier 2 "verified" is NOT equivalent to a Tier 0 "verified". The verdict must always carry the tier label.

---

## SECTION 4: OBSERVABILITY TIERS

| Tier | What Harness Sees | What It Can Prove |
|------|-------------------|-------------------|
| 0 | Full runtime: tool spans, artifacts, hashes | Hard-bind action claims to execution evidence |
| 1 | Partial runtime + transcript | Prove some action claims, downgrade the rest |
| 2 | Transcript, tool calls, citations, artifacts | Audit visible claims but not invisible execution |
| 3 | Final output only | Weak, mostly semantic judgments |

---

## SECTION 5: PIPELINE STAGES

The pipeline always runs in this order. No stage is optional. No stage decides whether to run the next.

### Stage 1: Trace Intake
Parse JSON conversation into canonical Trace object. Normalize messages, tool calls, citations, artifacts, timestamps, context blocks. **Already implemented in `packages/parser/trace_loader.py`.**

### Stage 2: Deterministic Checks (no LLM)
Run as code. Binary pass/fail. Highest trust. **Already implemented in `packages/deterministic_checks/checks.py`.**
- Tool-call existence: claimed tool use with no matching tool call
- Citation existence: cited sources not in context or tool outputs
- Required-tool policy: missing required tools for task types
- Schema validation: structural trace issues
- Keyword trigger scanner: flags high-risk action verbs for Stage 3
- Tool-output contradiction: obvious status inversions (failed vs passed)

### Stage 3: Semantic Calls (5 scoped LLM calls)
Each call gets only the data it needs. Returns structured JSON. The LLM never decides what to check. **Local heuristics implemented in `packages/semantic_calls/orchestrator.py`. Gemini adapter written but untested in `packages/adapters/gemini.py`. Router in `packages/semantic_calls/router.py`.**

| Call | Purpose | Input | Output Schema | Thinking Level |
|------|---------|-------|---------------|----------------|
| A | Claim extraction | Answer text + context | `[{claim_id, claim_text, claim_type, turn_index, evidence_refs}]` | Minimal |
| B | Unsupported claim detection | Claims + evidence + tool/citation inventory | `[{claim_id, classification, rationale_span_refs, confidence}]` | Medium |
| C | Capability claim classification | Capability claims + tool call log | `[{claim_id, capability_type, requires_runtime_proof, has_matching_tool_call, confidence}]` | Medium |
| D | Drift assessment | User request + system instructions + answer + tool outputs | `{drift, scope_violation, offending_spans, confidence}` | Medium |
| E | Contradiction detection | Claims + tool outputs + cited evidence | `[{claim_id, contradicted_by_refs, severity, confidence}]` | High |

Enforcement rules:
1. Pipeline decides which call runs — model never chooses
2. Each call sees only needed data
3. Outputs must validate against JSON schema
4. No semantic-only "verified" verdicts allowed
5. Deterministic evidence outranks semantic interpretation on conflict

### Stage 4: Verdict Assembly
Combine all findings, apply tier logic, emit structured verdict. **Already implemented in `packages/adjudicator/engine.py`.**

---

## SECTION 6: SEMANTIC CALL SYSTEM PROMPTS

All five system prompts are defined in `prompts/system_prompts.py`. Each prompt includes the exact JSON output schema, few-shot examples, classification rules, and instructions to say "no findings" when nothing is wrong. These prompts are ready to send through any LLM provider.

The prompts are accessible via:
```python
from prompts.system_prompts import PROMPTS
prompt_a = PROMPTS["A"]  # Claim extraction
prompt_b = PROMPTS["B"]  # Unsupported claim detection
prompt_c = PROMPTS["C"]  # Capability classification
prompt_d = PROMPTS["D"]  # Drift assessment
prompt_e = PROMPTS["E"]  # Contradiction detection
```

---

## SECTION 7: MODEL ASSIGNMENTS

The adapter is provider-agnostic. The current implementation targets Google Gemini. Model assignments per call:

| Call | Default Model | Thinking | Cost/MTok In/Out |
|------|---------------|----------|------------------|
| A | gemini-2.0-flash-lite (fallback) / gemini-3.1-flash-lite (latest) | Minimal | $0.25 / $1.50 |
| B | gemini-2.0-flash (fallback) / gemini-3-flash (latest) | Medium | $0.50 / $3.00 |
| C | gemini-2.0-flash (fallback) / gemini-3-flash (latest) | Medium | $0.50 / $3.00 |
| D | gemini-2.0-flash-lite (fallback) / gemini-3.1-flash-lite (latest) | Medium | $0.25 / $1.50 |
| E inline | gemini-2.0-flash-lite (fallback) / gemini-3.1-flash-lite (latest) | High | $0.25 / $1.50 |
| E post-hoc | gemini-2.5-pro (fallback) / gemini-3.1-pro (latest) | High | $2.00 / $12.00 |

Estimated cost: $0.003–$0.008 per check (inline), $0.01–$0.03 (post-hoc).

The adapter interface is defined in `packages/adapters/base.py`. Any provider that accepts structured prompts and returns JSON can be swapped in by implementing the `SemanticAdapter` abstract class.

---

## SECTION 8: QUALITY GATES

No phase advances until the prior phase meets these measured thresholds:

| Phase | Gate | Metric | Target |
|-------|------|--------|--------|
| 1a | Deterministic FP on clean | False positive rate | < 5% |
| 1a | Tool bypass detection | True positive rate | > 95% |
| 1a | Citation detection | True positive rate | > 95% |
| 1b | Call A output validity | Structured JSON parse success | > 99% |
| 1b | Call B recall | Unsupported claim recall | ≥ 85% |
| 1b | Call B precision | Unsupported claim precision | ≥ 80% |
| 1b | Call D drift recall | Material drift recall | ≥ 75% |
| 1b | Call D drift precision | Material drift precision | ≥ 80% |
| 1b | Call E precision | Contradiction precision | ≥ 85% |
| 1b | End-to-end FP | All findings combined on clean | < 10% |
| 1b | Latency | p95 on 40k-token trace | < 2 seconds |
| 1c | Tier correctness | Tier downgrade behavior | ≥ 95% |
| 1c | Verifier honesty | Semantic-only verified verdicts | 0 allowed |
| 1c | Runtime binding precision | Claim-to-span precision | ≥ 95% |
| 1c | Runtime binding recall | Claim-to-span recall | ≥ 90% |
| 1c | Tamper detection | Seeded fake execution cases caught | 100% |
| 2 | Upgrade safety | One-command model regression | 100% reproducible |

---

## SECTION 9: COMPLETE ROADMAP — WHAT TO BUILD

### PHASE 0: Scope Lock (2–3 days) — DONE
- [x] Freeze verdict taxonomy
- [x] Freeze observability tiers
- [x] Repo skeleton
- [x] Non-goals documented

### PHASE 1: Ground-truth Benchmark (Weeks 1–2) — DONE
- [x] 51 labeled traces (34 seeded, 17 clean)
- [x] Categories: tool bypass, citation fabrication, unsupported claims, contradictions, capability overclaim, context drift
- [x] Ground truth annotations with finding_id, category, severity, expected_verdict
- [x] Benchmark runner measuring precision/recall/FP rates

### PHASE 2: Deterministic CLI Auditor (Weeks 3–4) — DONE
- [x] Transcript parser
- [x] Tool-call existence check
- [x] Citation existence check
- [x] Required-tool policy check
- [x] Schema validation check
- [x] Keyword trigger scanner
- [x] Tool-output contradiction check
- [x] Smart deduplication
- [x] CLI with `check` and `benchmark` commands
- [x] Exit codes: 0 pass, 1 warn, 2 fail
- [x] Quality gate: <5% FP clean — PASSING
- [x] Quality gate: >95% tool bypass — PASSING
- [x] Quality gate: >95% citation — PASSING

### PHASE 3: Evidence-Binding / Semantic Layer (Weeks 5–6) — IN PROGRESS

This is where you are now. The following must be completed:

#### 3.1 Validate Gemini Adapter Against Live API
The adapter exists at `packages/adapters/gemini.py` but has never made a real API call.

Tasks:
1. Set `HHC_GEMINI_API_KEY` environment variable with a valid Gemini API key
2. Write a test script that calls each of the 5 semantic calls against 3 known traces
3. Fix any request formatting issues (URL construction, auth headers, body schema)
4. Fix any JSON parsing issues (the model may not always return clean JSON — handle markdown fences, preamble text, nested objects vs arrays)
5. Verify the response parsing in `_parse_call_a` through `_parse_call_e` produces the correct typed objects
6. Verify retry logic works on simulated 429 and 500 errors
7. Measure token consumption per call for cost estimation

Expected issues to fix:
- Gemini API URL format may differ from what's in the adapter — check against current Gemini API docs
- `responseMimeType: "application/json"` may not be supported on all Gemini models — may need to parse JSON from text output instead
- Thinking config format may differ — check Gemini docs for `thinkingConfig` vs `thinkingBudget` parameter names
- Some models may return thinking tokens in the response that need to be filtered before JSON parsing

Validation criteria: all 5 calls return parseable structured output on at least 10 different traces without crashing.

#### 3.2 Prompt Iteration
Each of the 5 system prompts in `prompts/system_prompts.py` needs testing against real LLM output.

Process per prompt:
1. Run the call against 20 traces from `datasets/seeded/` and `datasets/clean/`
2. Validate that the output parses as the expected JSON schema
3. Measure accuracy against ground truth labels
4. If accuracy is below the gate threshold, adjust the prompt:
   - Add more few-shot examples from failing cases
   - Clarify ambiguous instructions
   - Add explicit "do NOT flag X" rules for common false positive patterns
5. Re-run and re-measure
6. Repeat until the gate passes

Priority order:
1. **Call B** (unsupported claims) — gate: ≥85% recall, ≥80% precision. This is the hardest and most important.
2. **Call D** (drift) — gate: ≥75% recall, ≥80% precision. Currently 0% on local heuristics.
3. **Call E** (contradictions) — gate: ≥85% precision. Must catch number mismatches, status inversions, name mismatches.
4. **Call C** (capability claims) — must catch indirect triggers like "the issue was resolved", "performance improved to", "after deploying the fix"
5. **Call A** (claim extraction) — gate: >99% valid JSON output. Should be the easiest.

#### 3.3 Wire Router to Use Adapter
The router at `packages/semantic_calls/router.py` already handles this. When `HHC_GEMINI_API_KEY` is set, it creates a `GeminiAdapter` and routes calls through it. When not set, it falls back to local heuristics.

Verify:
1. `python -m apps.cli check datasets/seeded/tb_01_fake_search.json --full` uses the adapter when key is set
2. `python -m apps.cli benchmark datasets/ --full` runs all 51 traces through the adapter
3. The suppression logic in CLI and benchmark correctly prevents semantic findings from duplicating deterministic findings

#### 3.4 Run Full Benchmark and Hit Gates
```bash
python -m apps.cli benchmark datasets/ --full
```

Must achieve:
- Call B recall ≥ 85%
- End-to-end FP rate on clean traces < 10%
- p95 latency < 2s on a 40k-token trace

If gates fail, iterate on prompts (3.2) until they pass.

#### 3.5 Add Prompt Versioning
Create a system to track prompt versions.

Implementation:
- Add a `PROMPT_VERSIONS` dict in `prompts/system_prompts.py`:
```python
PROMPT_VERSIONS = {
    "A": "1.0.0",
    "B": "1.0.0",
    "C": "1.0.0",
    "D": "1.0.0",
    "E": "1.0.0",
}
```
- Include prompt versions in the `VerdictReport` output (add `prompt_versions: dict` field to `VerdictReport` in `packages/schemas/models.py`)
- Include prompt versions in the benchmark report output
- When any prompt changes, bump its version number

### PHASE 4: Tier-Aware Adjudicator Enhancements (Weeks 7–9)

#### 4.1 Configuration File
Create `config.yaml` at project root:
```yaml
# hhc/config.yaml
schema_version: "1.0.0"
checker_version: "1.0.0"
policy_version: "1.0.0"

# LLM Provider
provider: "gemini"
api_key_env: "HHC_GEMINI_API_KEY"

# Model assignments
models:
  call_a: "gemini-2.0-flash-lite"
  call_b: "gemini-2.0-flash"
  call_c: "gemini-2.0-flash"
  call_d: "gemini-2.0-flash-lite"
  call_e_inline: "gemini-2.0-flash-lite"
  call_e_posthoc: "gemini-2.5-pro"

# Thinking levels
thinking:
  call_a: "minimal"
  call_b: "medium"
  call_c: "medium"
  call_d: "medium"
  call_e: "high"

# Verdict thresholds
thresholds:
  fail_on: ["contradicted", "policy_violation"]
  warn_on: ["unsupported", "insufficient_evidence", "unverifiable_at_tier"]
  unverifiable_threshold: 0.4  # Flag if >40% of claims are unverifiable

# API service
api:
  host: "0.0.0.0"
  port: 8000
  auth_enabled: false
  rate_limit_per_minute: 60
  cors_origins: ["*"]
```

Create `packages/config.py` to load and validate this config:
```python
import yaml
from pathlib import Path
from dataclasses import dataclass

@dataclass
class HHCConfig:
    # ... fields matching config.yaml structure
    
    @classmethod
    def load(cls, path: str = "config.yaml") -> "HHCConfig":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls(**data)
```

Note: This requires `pip install pyyaml`.

Update `GeminiConfig`, `cli.py`, and `api.py` to read from this config instead of hardcoded values.

#### 4.2 Unverifiable Threshold Warning
In `packages/adjudicator/engine.py`, after computing the summary, add:
```python
unverifiable_ratio = summary.claims_unverifiable / summary.total_claims_extracted
if unverifiable_ratio > config.thresholds.unverifiable_threshold:
    findings.append(Finding(
        finding_id="tier_insufficient",
        category="tier_warning",
        verdict=Verdict.UNVERIFIABLE_AT_TIER,
        finding_source=FindingSource.DETERMINISTIC,
        severity=Severity.MEDIUM,
        turn_index=0,
        claim_text=f"{unverifiable_ratio:.0%} of claims are unverifiable at current tier",
        explanation="Consider upgrading observability tier for meaningful verification.",
    ))
```

#### 4.3 Configurable Severity Thresholds
Read `fail_on` and `warn_on` from config instead of hardcoding in `compute_overall_verdict()`. This lets deployments decide what triggers fail vs warn.

### PHASE 5: Runtime Proof Binder / Service Hardening (Weeks 10–12)

#### 5.1 Unit Tests
Create `tests/` directory with:
```
tests/
├── __init__.py
├── test_checks.py           # One test per deterministic check function
├── test_parser.py           # Parser handles malformed input gracefully
├── test_adjudicator.py      # Tier detection, downgrade logic, verdict computation
├── test_adapter.py          # Mock adapter tests
├── test_benchmark.py        # Benchmark matching logic
└── test_api.py              # API endpoint tests
```

Use `unittest` (stdlib) or `pytest` if available.

Each test in `test_checks.py` should:
1. Create a minimal Trace with known data
2. Run one check function
3. Assert the expected findings (or no findings)

Example:
```python
def test_tool_bypass_detected():
    trace = Trace(
        trace_id="test_1",
        user_request="search for X",
        messages=[
            Message(turn_index=0, role="user", content="search for X"),
            Message(turn_index=1, role="assistant", content="I searched the web and found Y"),
        ],
    )
    findings = check_tool_call_existence(trace)
    assert len(findings) >= 1
    assert findings[0].category == "tool_bypass"
    assert findings[0].verdict == Verdict.UNSUPPORTED

def test_tool_bypass_not_triggered_when_tool_exists():
    trace = Trace(
        trace_id="test_2",
        user_request="search for X",
        messages=[
            Message(turn_index=0, role="user", content="search for X"),
            Message(turn_index=1, role="assistant", content="I searched the web.",
                    tool_calls=[ToolCall(tool_call_id="tc1", tool_name="web_search",
                                         outputs="result Y")]),
        ],
    )
    findings = check_tool_call_existence(trace)
    assert len(findings) == 0
```

Write at least 3 tests per check function: positive case (finding produced), negative case (no finding), edge case.

#### 5.2 Docker Packaging
Create `Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install fastapi uvicorn pyyaml --no-cache-dir
EXPOSE 8000
CMD ["uvicorn", "apps.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `docker-compose.yml`:
```yaml
version: "3.8"
services:
  hhc:
    build: .
    ports:
      - "8000:8000"
    environment:
      - HHC_GEMINI_API_KEY=${HHC_GEMINI_API_KEY}
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./datasets:/app/datasets
```

#### 5.3 API Hardening
In `apps/api.py`, add:

1. **Authentication**: Simple API key middleware
```python
@app.middleware("http")
async def check_auth(request, call_next):
    if request.url.path in ("/health", "/version"):
        return await call_next(request)
    api_key = request.headers.get("X-API-Key", "")
    if config.api.auth_enabled and api_key != config.api.api_key:
        return JSONResponse(status_code=401, content={"error": "Invalid API key"})
    return await call_next(request)
```

2. **Rate limiting**: Simple in-memory rate limiter
```python
from collections import defaultdict
import time

_rate_limits = defaultdict(list)

@app.middleware("http")
async def rate_limit(request, call_next):
    client_ip = request.client.host
    now = time.time()
    _rate_limits[client_ip] = [t for t in _rate_limits[client_ip] if now - t < 60]
    if len(_rate_limits[client_ip]) >= config.api.rate_limit_per_minute:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})
    _rate_limits[client_ip].append(now)
    return await call_next(request)
```

3. **CORS**: Add CORS middleware from FastAPI
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=config.api.cors_origins, ...)
```

4. **Request validation**: Validate trace structure before processing
```python
@app.post("/run")
async def run_check(request: Request):
    body = await request.json()
    if "messages" not in body:
        raise HTTPException(400, "Trace must contain 'messages' field")
    if not isinstance(body["messages"], list):
        raise HTTPException(400, "'messages' must be a list")
    # ... etc
```

#### 5.4 Pipeline Logging
Create `packages/logging.py`:
```python
import json
import time
from dataclasses import dataclass, asdict

@dataclass
class PipelineLog:
    trace_id: str
    stage: str
    duration_ms: float
    findings_count: int
    tokens_input: int = 0
    tokens_output: int = 0
    model_used: str = ""
    error: str = ""

def log_json(entry: PipelineLog):
    print(json.dumps(asdict(entry)))
```

Wrap each stage in timing:
```python
start = time.time()
findings = run_all_deterministic_checks(trace)
elapsed = (time.time() - start) * 1000
log_json(PipelineLog(trace.trace_id, "deterministic", elapsed, len(findings)))
```

#### 5.5 OTel Integration (Tier 0–1)
Create `packages/telemetry/ingestion.py`:

1. Accept OpenTelemetry span data (JSON format from OTel exporters)
2. Normalize spans into internal `EvidenceRef` objects
3. Map span attributes to tool calls: `span.name` → tool name, `span.attributes` → inputs/outputs
4. Add runtime spans to `Trace.runtime_spans`
5. When runtime spans are present, the tier detector in `adjudicator/engine.py` upgrades from Tier 2 to Tier 0/1

Create `packages/telemetry/matcher.py`:

1. The declared-vs-observed matcher: for each agent claim of tool use, check if a matching runtime span exists
2. If the agent says "I searched the web" AND a runtime span shows a web_search tool call, the claim is verified at Tier 0
3. If the agent claims an action but NO runtime span exists despite Tier 0 instrumentation, this is stronger evidence of a bypass than transcript-only analysis

#### 5.6 Regression Test Runner
Create `packages/evals/regression.py`:
```python
def run_regression(dataset_dir, models_a, models_b):
    """Run benchmark with two different model configs and compare."""
    report_a = run_benchmark(dataset_dir, full_pipeline=True)  # using models_a
    report_b = run_benchmark(dataset_dir, full_pipeline=True)  # using models_b
    
    # Compare precision, recall, FP rate, per-category rates
    # Output: which model config is better on which metrics
    # Flag any regressions (metric got worse)
```

#### 5.7 Runbook
Create `docs/runbook.md` covering:
1. How to install and configure (prerequisites, config.yaml, API key)
2. How to run the CLI (`check` and `benchmark` commands with all flags)
3. How to deploy the API service (Docker, direct, environment variables)
4. How to interpret verdicts (what each verdict means, what to do about it)
5. How to troubleshoot false positives (check which finding_source, look at evidence_refs)
6. How to add new benchmark traces (JSON format, ground truth labeling, running benchmark)
7. How to iterate on prompts (edit prompts/system_prompts.py, bump version, re-benchmark)
8. How to swap model providers (implement SemanticAdapter, update config.yaml)

#### 5.8 API Documentation
FastAPI auto-generates OpenAPI docs at `/docs` (Swagger UI) and `/redoc`. Ensure all endpoints have docstrings and type hints for automatic schema generation.

### PHASE 6: Upgrade-Safe Eval Harness (Weeks 13–14)

#### 6.1 Model Regression Runner
Build on 5.6. Create a CLI command:
```bash
python -m apps.cli regression datasets/ --config-a config_gemini.yaml --config-b config_openai.yaml
```

Output a comparison table showing per-metric deltas.

#### 6.2 Override and Suppression System
Create `packages/overrides.py`:

```python
@dataclass
class Override:
    finding_id: str
    trace_id: str
    action: str  # "suppress", "downgrade", "accept"
    reviewer: str
    reason: str
    timestamp: str
    pattern_hash: str  # Hash of (category, claim_text pattern) for auto-suppression

@dataclass  
class SuppressionRule:
    pattern_hash: str
    category: str
    claim_pattern: str  # regex
    override_count: int
    auto_suppress: bool  # True after 3 overrides
```

Store overrides in `overrides.jsonl`. On each run, load overrides and suppress matching findings before verdict assembly.

#### 6.3 Second Provider Adapter
Implement `packages/adapters/openai.py` or `packages/adapters/anthropic.py` following the same `SemanticAdapter` interface. This validates the abstraction and provides a fallback.

### PHASE 7: Cross-Agent Provenance (Phase 2, Weeks 15–18)

#### 7.1 Handoff Records
Extend the Trace schema with:
```python
@dataclass
class AgentHandoff:
    source_agent_id: str
    destination_agent_id: str
    source_trace_id: str
    message_id: str
    inherited_evidence_refs: list[EvidenceRef]
    new_evidence_refs: list[EvidenceRef]
    trust_downgrade: bool  # True if claim repeated without original provenance
```

Add `handoffs: list[AgentHandoff]` to the `Trace` dataclass.

#### 7.2 Evidence Chain Integrity
Every `artifact_ref` and `evidence_ref` must carry:
- `artifact_id`
- `content_hash` (SHA-256)
- `source_trace_id`
- `created_at`
- `signature` (optional, for signed evidence)
- `lineage_ref` (for downstream reuse)

Rule: downstream agent may reference upstream evidence only by immutable reference plus content hash. Mismatched hash → downgrade or reject.

#### 7.3 Trust Downgrade Flags
When a claim propagates across agents without its original provenance, flag it. This prevents speculative claims from hardening into "facts" through a chain of agents.

#### 7.4 Trajectory Anomaly Detection
Create `packages/trajectory.py`:
- Drift over time (not just single-point): compare agent behavior across 10+ turns
- Cycle detection: agent repeating the same approach without progress
- Scope creep: subtasks expanding beyond original request

#### 7.5 Challenge Round Protocol (post-hoc only)
For risky claims in post-hoc audit mode:
1. Detect risky claim
2. Classify claim type
3. Request required provenance fields
4. Reconcile fields against observed artifacts
5. Issue verdict

A challenge round must never pass a claim based only on a more detailed narrative. Resolution requires matching against external state.

### PHASE 8: Advanced Detection (Phase 3, Weeks 19–24)

#### 8.1 Memory Auditing
Track assertions at each stage of long conversations. Detect when later assertions contradict earlier established facts. Flag compounding errors where incorrect intermediate conclusions feed downstream reasoning.

#### 8.2 Long-Horizon Drift Detection
Extend Call D to work across conversations >50k tokens. Score trajectory-level drift, not just current-state drift.

#### 8.3 Capability-Claim Classifier
Replace keyword triggers with a trained classifier that catches direct, indirect, and paraphrased action claims. Train on accumulated data from evaluation runs.

#### 8.4 Roleplay Boundary Detection
Verify that fictional statements do not escape into literal execution claims without explicit labeling. Flag mode transitions between narrative, analytic, and operational contexts.

#### 8.5 Automated False-Positive Suppression
Implement confidence-weighted pattern learning from human overrides. If the harness flags the same pattern and a human overrides it 3 times, auto-suppress with a logged justification.

#### 8.6 Adversarial Resistance Characterization
Test pipeline against deliberately evasive agent outputs. Document which evasion strategies succeed. This is research, not production code — output is a threat model document, not a feature.

---

## SECTION 10: DEPENDENCIES

### Phase 1a–1b (current): Zero external dependencies
Everything runs on Python 3.12+ stdlib. The Gemini adapter uses `urllib.request` for HTTP calls.

### Phase 3+ additions:
```
fastapi>=0.100.0          # API service
uvicorn>=0.20.0           # ASGI server
pyyaml>=6.0               # Config file parsing
```

### Optional:
```
pytest>=8.0               # Testing (can use unittest instead)
opentelemetry-api>=1.20   # OTel integration (Phase 1c)
opentelemetry-sdk>=1.20   # OTel integration (Phase 1c)
docker                    # Docker packaging
```

---

## SECTION 11: COMMANDS REFERENCE

```bash
# Run single trace (deterministic only)
python -m apps.cli check <trace.json>

# Run single trace (full pipeline with LLM)
python -m apps.cli check <trace.json> --full

# Output verdict to file
python -m apps.cli check <trace.json> --output verdict.json

# Print JSON to stdout
python -m apps.cli check <trace.json> --json

# Run benchmark (deterministic)
python -m apps.cli benchmark datasets/

# Run benchmark (full pipeline)
python -m apps.cli benchmark datasets/ --full

# Output benchmark report to JSON
python -m apps.cli benchmark datasets/ --output report.json

# Generate benchmark traces
python datasets/generate_traces.py
python datasets/generate_traces_v2.py

# Start API service (requires fastapi + uvicorn)
python apps/api.py
# or
uvicorn apps.api:app --host 0.0.0.0 --port 8000
```

---

## SECTION 12: BUILD-VS-BORROW

| Component | Decision | What to Use |
|-----------|----------|-------------|
| Telemetry/tracing | BORROW | OpenTelemetry / OpenLLMetry |
| Math/logic checks | BORROW or FORK | Z3, SymPy for formal checks |
| Claim extraction | ADAPT | RefChecker-style triplet extraction |
| Eval assertions | BORROW selectively | Promptfoo / Inspect ideas |
| Tier-aware adjudicator | BUILD | Custom Python — this is the moat |
| Declared-vs-observed matcher | BUILD | Custom Python |
| Verdict schema + policy layer | BUILD | Custom schemas — must be stable across model upgrades |
| Upgrade-safe benchmark | BUILD | Custom dataset + regression runner |

---

## SECTION 13: RISKS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Semantic verifier fabricates findings | Trust collapse | Track deterministic vs semantic FP separately; semantic never outranks hard evidence |
| Benchmark too synthetic | Misleading gates | Supplement seeded data with real production traces over time |
| Tier logic hidden from users | Users assume all "verified" means the same | Expose tier + skipped checks in every verdict |
| Engineering scope creep | Product drifts into generic hallucination platform | Freeze scope around receipt-checker thesis |
| Telemetry gaps in production | Claims become unverifiable | Make tier downgrade explicit; instrument high-value workflows first |
| Preview model volatility | LLM behavior changes | Adapter abstraction enables provider swap; versioned eval suite |
| False positives too high | Teams route around the system | Override mechanism + auto-suppression from repeated overrides |

---

## SECTION 14: HARD RULES FOR THE BUILD

1. Do not let semantic checks certify objective truth when deterministic evidence is available.
2. Do not allow the verdict layer to silently upgrade a weak-evidence case into "verified."
3. Do not tie the product to one provider-specific prompt format if the adapter can abstract it.
4. Do not overbuild multi-agent provenance before the single-agent runtime binder works.
5. Do not add more detection categories faster than the benchmark can support them.
6. Do not build custom telemetry collectors when standard OTel inputs are enough.
7. The target agent does not get to rebut the harness.
8. Every verdict must carry the observability tier and list skipped checks.

---

## SECTION 15: DEFINITION OF DONE FOR FIRST SHIPPABLE VERSION

- [ ] CLI and API accept a trace and return a structured verdict with tier labeling
- [ ] Tool-bypass and missing-citation failures caught deterministically at >95%
- [ ] Claims classified into all six verdict categories
- [ ] Semantic layer passes quality gates (Call B ≥85% recall, end-to-end FP <10%)
- [ ] Drift evaluated and can trigger policy violation
- [ ] Finding source (deterministic vs semantic) visible in every finding
- [ ] Benchmark re-runnable after model swap without rewriting the harness
- [ ] Config file for all tunable parameters
- [ ] Docker packaging for API service
- [ ] Unit tests for all deterministic check functions
- [ ] Runbook for deployment and operation
