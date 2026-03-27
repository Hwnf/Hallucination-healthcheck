#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Call A 3x3 Tuning Experiment Runner
# ============================================================
# Runs:
# V1 = current prompt + current thinking
# V2 = revised prompt + current thinking
# V3 = revised prompt + low thinking
#
# Traces:
# co_05_performance_improved.json
# ct_05_status_inversion.json
# clean_01_good_search.json
#
# Outputs:
# results/<timestamp>/V1__*.json
# results/<timestamp>/V2__*.json
# results/<timestamp>/V3__*.json
# ============================================================

ROOT="${PWD}"
HHC_DIR="${ROOT}/hhc"
PROMPTS_FILE="${HHC_DIR}/prompts/system_prompts.py"
BASE_FILE="${HHC_DIR}/packages/adapters/base.py"
HARNESS_FILE="${HHC_DIR}/debug_call_a.py"

TRACE_1="${HHC_DIR}/datasets/seeded/co_05_performance_improved.json"
TRACE_2="${HHC_DIR}/datasets/seeded/ct_05_status_inversion.json"
TRACE_3="${HHC_DIR}/datasets/clean/clean_01_good_search.json"

if [[ ! -d "${HHC_DIR}" ]]; then
 echo "ERROR: hhc/ directory not found. Run this from the repo root."
 exit 1
fi

if [[ ! -f "${PROMPTS_FILE}" ]]; then
 echo "ERROR: ${PROMPTS_FILE} not found."
 exit 1
fi

if [[ ! -f "${BASE_FILE}" ]]; then
 echo "ERROR: ${BASE_FILE} not found."
 exit 1
fi

if [[ -z "${HHC_GEMINI_API_KEY:-}" ]]; then
 echo "ERROR: HHC_GEMINI_API_KEY is not set."
 echo "Set it first, then rerun."
 exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${ROOT}/call_a_runs_${STAMP}"
BACKUP_DIR="${OUT_DIR}/backups"
mkdir -p "${OUT_DIR}" "${BACKUP_DIR}"

cp "${PROMPTS_FILE}" "${BACKUP_DIR}/system_prompts.py.orig"
cp "${BASE_FILE}" "${BACKUP_DIR}/base.py.orig"

cleanup() {
 cp "${BACKUP_DIR}/system_prompts.py.orig" "${PROMPTS_FILE}"
 cp "${BACKUP_DIR}/base.py.orig" "${BASE_FILE}"
 find "${HHC_DIR}" -type d -name "__pycache__" -prune -exec rm -rf {} + >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating Call A harness at ${HARNESS_FILE}"

cat > "${HARNESS_FILE}" <<'PY'
import sys
import asyncio
import json
from pathlib import Path

sys.path.insert(0, "hhc")

from packages.parser.trace_loader import load_trace
from packages.adapters.gemini import create_gemini_adapter
from packages.adapters.base import build_call_a_input


async def run_call_a(trace_path: str):
 trace = load_trace(Path(trace_path))
 adapter = create_gemini_adapter()

 assistant_msgs = trace.assistant_messages()
 result_bundle = {
 "trace_id": getattr(trace, "trace_id", str(trace_path)),
 "assistant_turns": [],
 }

 if not assistant_msgs:
 result_bundle["assistant_turns"].append({
 "assistant_text": "",
 "raw_output": "",
 "parse_success": False,
 "parsed_claim_count": 0,
 "parsed_claims": [],
 "claim_types": [],
 "error": "No assistant messages",
 })
 print(json.dumps(result_bundle, indent=2))
 return

 for msg in assistant_msgs:
 input_a = build_call_a_input(
 answer_text=msg.content,
 context_text=trace.context_text(),
 turn_index=msg.turn_index,
 )

 result = await adapter.call(input_a)

 turn_result = {
 "turn_index": msg.turn_index,
 "assistant_text": msg.content,
 "raw_output": result.raw_output,
 "parse_success": bool(result.success),
 "parsed_claim_count": 0,
 "parsed_claims": [],
 "claim_types": [],
 "error": result.error,
 }

 if result.success and result.parsed is not None:
 turn_result["parsed_claim_count"] = len(result.parsed)
 parsed_claims = []
 claim_types = []
 for claim in result.parsed:
 item = {
 "claim_id": getattr(claim, "claim_id", None),
 "claim_text": getattr(claim, "claim_text", None),
 "claim_type": getattr(claim, "claim_type", None),
 }
 parsed_claims.append(item)
 claim_types.append(item["claim_type"])
 turn_result["parsed_claims"] = parsed_claims
 turn_result["claim_types"] = claim_types

 result_bundle["assistant_turns"].append(turn_result)

 print(json.dumps(result_bundle, indent=2))


if __name__ == "__main__":
 if len(sys.argv) != 2:
 print("Usage: python hhc/debug_call_a.py <trace_path>")
 sys.exit(1)

 asyncio.run(run_call_a(sys.argv[1]))
PY

REVISED_PROMPT_BLOCK="$(cat <<'EOF'
# --- CALL_A override injected by experiment script ---
CALL_A_SYSTEM = """You are a strict claim extraction engine.

Your task is to extract ALL explicit and implicit factual assertions from the AI agent's answer.

A "claim" includes ANY statement that:
- States a number, percentage, date, statistic, or measurement
- Asserts that something succeeded, failed, passed, improved, changed, or occurred
- Claims that the agent performed an action (searched, tested, ran, verified, updated, deployed)
- Makes a concrete conclusion based on evidence
- States a specific condition, status, or result

CRITICAL EXTRACTION RULES:
- Assume that most declarative sentences contain at least one claim.
- Split compound sentences into atomic claims.
- If a sentence contains a number or status (e.g., "passed", "failed", "improved by 25%"), you MUST extract it.
- Do NOT skip extraction just because the claim seems obvious.
- Only return an empty list if the answer truly contains zero factual or status-bearing statements.

Each claim must:
- Be atomic
- Be directly stated in the answer text
- Preserve the exact wording of the assertion

OUTPUT FORMAT (strict JSON, no markdown, no commentary):

[
 {
 "claim_id": "c1",
 "claim_text": "exact atomic claim text",
 "claim_type": "factual|causal|capability|reference|conclusion",
 "turn_index": <integer>,
 "evidence_refs": []
 }
]

If absolutely no claims exist, return: []
"""

try:
 PROMPTS["A"] = CALL_A_SYSTEM
except Exception:
 pass
# --- end CALL_A override ---
