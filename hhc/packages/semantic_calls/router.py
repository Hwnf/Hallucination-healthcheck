from __future__ import annotations
# ────────────────────────────────────────────────
# Semantic Plan Decision
# ────────────────────────────────────────────────
def get_semantic_plan(
 trace: Trace,
 deterministic_findings: list[Finding],
) -> list[str]:
 plan: list[str] = []

 assistant_msgs = trace.assistant_messages()
 if not assistant_msgs:
  return plan

 assistant_text = " ".join(m.content for m in assistant_msgs)
 assistant_lower = assistant_text.lower()

 has_substantive_answer = len(assistant_text.strip()) > 20
 has_digits = any(c.isdigit() for c in assistant_text)
 has_capability_verbs = any(
  v in assistant_lower
  for v in ["searched", "ran", "executed", "tested", "verified"]
 )

 # Evidence availability
 tool_calls = trace.all_tool_calls()
 tool_outputs = [tc.outputs for tc in tool_calls if tc.outputs]
 context_text = trace.context_text()
 has_evidence = bool(tool_outputs or context_text)

 # Surface contradiction/status cues
 has_status_language = any(
  token in assistant_lower
  for token in [
   "up", "down", "healthy", "running", "failed",
   "passed", "normal", "error", "available",
   "unavailable", "success", "successful"
  ]
 )

 if has_substantive_answer:
  plan.append("A")

 if has_digits:
  plan.append("B")

 if has_capability_verbs:
  plan.append("C")

 if trace.user_request:
  plan.append("D")

 # Schedule contradiction checking whenever there is
 # meaningful answer text plus evidence and either
 # status/result language or numeric/factual surface cues.
 if has_substantive_answer and has_evidence and (has_status_language or has_digits):
  plan.append("E")

 return list(dict.fromkeys(plan))


import asyncio
from typing import Optional

from packages.schemas.models import (
    Trace, Finding, EvidenceRef, Verdict, FindingSource, Severity,
)
from packages.adapters.base import (
    SemanticAdapter, SemanticCallInput, SemanticCallResult,
    ExtractedClaim, ClaimClassification, CapabilityClassification,
    DriftAssessment, ContradictionResult,
    build_call_a_input, build_call_b_input, build_call_c_input,
    build_call_d_input, build_call_e_input,
)


class SemanticRunner:
    """
    Routes semantic calls through an adapter.
    Orchestrator decides the plan.
    Runner executes only approved calls.
    """

    def __init__(self, adapter: Optional[SemanticAdapter] = None):
        self.adapter = adapter

    def run_local(self, trace: Trace) -> list[Finding]:
        """
        Local execution is handled by orchestrator.
        Keep this as a safe no-op fallback.
        """
        return []

    async def run(self, trace: Trace):
        """ Backward-compatible full-plan execution. """
        return await self.execute_plan(trace, ["A", "B", "C", "D", "E"])

    async def execute_plan(self, trace: Trace, plan: list[str]):
        """
        Execute only the semantic calls approved in `plan`.
        Returns raw adapter result objects for orchestrator normalization:
        - ClaimClassification
        - CapabilityClassification
        - DriftAssessment
        - ContradictionResult
        """
        if not self.adapter:
            return self.run_local(trace)

        results: list[object] = []

        assistant_msgs = trace.assistant_messages()
        if not assistant_msgs:
            return results

        context_text = trace.context_text()
        tool_calls = trace.all_tool_calls()
        tool_outputs = [tc.outputs for tc in tool_calls if tc.outputs]
        tool_names = [tc.tool_name for tc in tool_calls]
        citation_names = [c.source_text for c in trace.all_citations()]

        all_claims = []

        # Call A: Claim extraction
        if "A" in plan:
            for msg in assistant_msgs:
                input_a = build_call_a_input(
                    answer_text=msg.content,
                    context_text=context_text,
                    turn_index=msg.turn_index,
                )
                result_a = await self.adapter.call(input_a)
                if result_a.success and result_a.parsed:
                    results.extend(result_a.parsed)
                    for claim in result_a.parsed:
                        all_claims.append({
                            "claim_id": claim.claim_id,
                            "claim_text": claim.claim_text,
                            "claim_type": claim.claim_type,
                            "turn_index": claim.turn_index,
                            "evidence_refs": claim.evidence_refs,
                        })

        # Call B: Unsupported claim detection
        if "B" in plan and all_claims:
            input_b = build_call_b_input(
                claims=all_claims,
                evidence_snippets=tool_outputs + [context_text] if context_text else tool_outputs,
                tool_inventory=tool_names,
                citation_inventory=citation_names,
            )
            result_b = await self.adapter.call(input_b)
            if result_b.success and result_b.parsed:
                results.extend(result_b.parsed)

        # Call C: Capability claim classification
        if "C" in plan and all_claims:
            capability_claims = [c for c in all_claims if c["claim_type"] == "capability"]
            if capability_claims:
                tool_call_log = [
                    {
                        "tool_call_id": tc.tool_call_id,
                        "tool_name": tc.tool_name,
                        "turn_index": tc.turn_index,
                        "has_output": tc.outputs is not None,
                    }
                    for tc in tool_calls
                ]
                input_c = build_call_c_input(
                    capability_claims=capability_claims,
                    tool_call_log=tool_call_log,
                )
                result_c = await self.adapter.call(input_c)
                if result_c.success and result_c.parsed:
                    results.extend(result_c.parsed)

        # Call D: Drift assessment
        if "D" in plan and assistant_msgs:
            last_answer = assistant_msgs[-1].content
            user_request = trace.user_request
            if not user_request:
                user_msgs = [m for m in trace.messages if m.role == "user"]
                user_request = user_msgs[0].content if user_msgs else ""
            if user_request and last_answer:
                input_d = build_call_d_input(
                    user_request=user_request,
                    system_instructions=trace.system_instructions or "",
                    answer_text=last_answer,
                    tool_outputs=tool_outputs,
                )
                result_d = await self.adapter.call(input_d)
                if result_d.success and result_d.parsed:
                    results.append(result_d.parsed)

        # Call E: Contradiction detection
        if "E" in plan and all_claims:
            factual_claims = [
                c for c in all_claims
                if c["claim_type"] in ("factual", "reference", "conclusion")
            ]
            if factual_claims and (tool_outputs or context_text):
                input_e = build_call_e_input(
                    claims=factual_claims,
                    tool_outputs=tool_outputs,
                    cited_evidence=[context_text] if context_text else [],
                )
                result_e = await self.adapter.call(input_e)
                if result_e.success and result_e.parsed:
                    results.extend(result_e.parsed)

        return results


# Updated factory

def create_semantic_runner(
    adapter: Optional[SemanticAdapter] = None,
    api_key: str = "",
    post_hoc: bool = False,
    use_latest_models: bool = False,
) -> SemanticRunner:
    """
    Create a semantic runner.
    Preferred path:
    - direct adapter injection

    Legacy-compatible path:
    - api_key or HHC_GEMINI_API_KEY from env
    """
    import os

    if adapter is not None:
        return SemanticRunner(adapter=adapter)

    key = api_key or os.environ.get("HHC_GEMINI_API_KEY", "")

    if api_key:
        os.environ["HHC_GEMINI_API_KEY"] = api_key

    if key:
        from packages.adapters.gemini import create_gemini_adapter
        try:
            return SemanticRunner(adapter=create_gemini_adapter(post_hoc=post_hoc))
        except TypeError:
            return SemanticRunner(adapter=create_gemini_adapter())

    return SemanticRunner(adapter=None)
