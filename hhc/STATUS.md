# HHC — Phase 1b Checkpoint

## Baseline (Deterministic Only)
- Traces: 51
- Precision: 85.7%
- Recall: 52.9%
- Clean FP Rate: 0.0%

## After Enabling Semantic Layer (--full)
- Precision: 67.6%
- Recall: 67.6%
- Clean FP Rate: 11.8%

## Current Findings
- Gemini adapter functional (live API confirmed)
- JSON extraction stable
- Semantic layer contributing TPs (5) and FPs (8)
- Major issues:
  - Clean false positives too high
  - Call B (unsupported_claim) underperforming
  - Drift detection weak

## Phase Status
✅ Phase 1a complete
🔧 Phase 1b in progress (prompt calibration)
⛔ Phases 1c–5 not started

## Immediate Next Actions
1. Tighten Call B prompt (unsupported_claim)
2. Tighten Call D prompt (context_drift)
3. Rerun benchmark with --full
4. Achieve gates:
   - Call B recall > 85%
   - Call B precision > 80%
   - Clean FP rate < 10%
   - p95 latency < 2s

---
Checkpoint created before further prompt modifications.
