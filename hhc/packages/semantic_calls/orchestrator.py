"""
Semantic call orchestrator — Stage 3 of the pipeline.

V3.1 Section 10: Five bounded semantic calls.
The pipeline decides which call runs. The model never chooses the checks.
Each call sees only the data needed for its task.

This module also includes a local rule-based analyzer for offline/testing use.
When a real LLM adapter is configured, these are replaced by actual API calls.
"""

from __future__ import annotations
import re
from typing import Optional

from packages.schemas.models import (
    Trace, Finding, EvidenceRef, Verdict, FindingSource, Severity,
    DriftLevel, ClaimType,
)


# ────────────────────────────────────────────────
# Call A: Claim Extraction (local heuristic)
# ────────────────────────────────────────────────

def extract_claims_local(trace: Trace) -> list[dict]:
    """
    Local claim extraction. Extracts factual and capability claims
    from assistant messages using pattern matching.

    In production, this is replaced by LLM Call A.
    """
    claims = []
    claim_counter = 0

    for msg in trace.assistant_messages():
        sentences = _split_sentences(msg.content)
        for sent in sentences:
            claim_type = _classify_sentence(sent)
            if claim_type:
                claim_counter += 1
                claims.append({
                    "claim_id": f"c{claim_counter}",
                    "claim_text": sent.strip(),
                    "claim_type": claim_type,
                    "turn_index": msg.turn_index,
                    "evidence_refs": [],
                })

    return claims


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    # Simple sentence splitting
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p for p in parts if len(p.strip()) > 10]


def _classify_sentence(sent: str) -> Optional[str]:
    """Classify a sentence as a claim type or None."""
    sent_lower = sent.lower()

    # Capability claims
    capability_patterns = [
        # Explicit first-person action only
        r'\b(?:i|we)\s+(?:searched|ran|executed|tested|verified|fetched|read|queried|checked|computed|deployed|confirmed|validated|resolved)',
        # Explicit agent-asserted deployment phrasing
        r'\bafter deploying\b',
    ]
    for pat in capability_patterns:
        if re.search(pat, sent_lower):
            return "capability"

    # Pure arithmetic (e.g., "15% of 200 is 30") → treat as derived conclusion
    if re.match(r"^\s*\d", sent_lower) and " of " in sent_lower and " is " in sent_lower:
        words = re.findall(r"[a-z]{3,}", sent_lower)
        if not words:
            return "conclusion"

    # Factual claims with numbers
    if re.search(r'\d+(?:\.\d+)?(?:%|billion|million|thousand|\$|€|£)', sent_lower):
        return "factual"

    # Reference claims
    if re.search(r'(?:according to|source:|reference:|as (?:stated|noted|reported) (?:in|by))', sent_lower):
        return "reference"

    # Conclusions
    if re.search(r'(?:therefore|thus|this means|in conclusion|as a result|consequently)', sent_lower):
        return "conclusion"

    # Factual claims with specific names/dates/versions
    if re.search(r'(?:version \d|v\d|\d{4}-\d{2}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b)', sent):
        return "factual"

    return None


# ────────────────────────────────────────────────
# Call B: Unsupported Claim Detection (local)
# ────────────────────────────────────────────────

def detect_unsupported_claims_local(
    claims: list[dict],
    trace: Trace,
) -> list[Finding]:
    """
    Local unsupported claim detection. Checks extracted claims
    against available evidence.

    Catches: number mismatches, facts not in context, citations without sources.
    In production, replaced by LLM Call B.
    """
    findings = []
    context_text = trace.context_text().lower()
    tool_outputs = " ".join(
        tc.outputs.lower() for tc in trace.all_tool_calls() if tc.outputs
    )
    all_evidence = context_text + " " + tool_outputs

    for claim in claims:
        if claim["claim_type"] == "capability":
            # Capability claims handled by Call C
            continue

        claim_text = claim["claim_text"]
        turn_idx = claim["turn_index"]

        # Check for number mismatches against context
        numbers_in_claim = _extract_numbers(claim_text)
        if numbers_in_claim:
            numbers_in_evidence = _extract_numbers(all_evidence)

            # If there is NO evidence at all, any specific numeric claim is unsupported
            if not all_evidence.strip():
                findings.append(Finding(
                    finding_id=f"sem_unsupported_{claim['claim_id']}",
                    category="unsupported_claim",
                    verdict=Verdict.UNSUPPORTED,
                    finding_source=FindingSource.SEMANTIC,
                    severity=Severity.HIGH,
                    turn_index=turn_idx,
                    claim_text=claim_text,
                    explanation="Numeric claim made with no supporting context or tool output.",
                    confidence=0.9,
                    semantic_call="B",
                ))
                continue

            for num_claim in numbers_in_claim:
                if not _number_in_evidence(num_claim, numbers_in_evidence, all_evidence):
                    findings.append(Finding(
                        finding_id=f"sem_unsupported_{claim['claim_id']}",
                        category="unsupported_claim",
                        verdict=Verdict.UNSUPPORTED,
                        finding_source=FindingSource.SEMANTIC,
                        severity=Severity.HIGH,
                        turn_index=turn_idx,
                        claim_text=claim_text,
                        explanation=(
                            f"Claim contains '{num_claim}' which does not appear in "
                            f"any available context or tool output."
                        ),
                        confidence=0.85,
                        semantic_call="B",
                    ))
                    break

    return findings


def _extract_numbers(text: str) -> list[str]:
    """Extract meaningful numbers from text."""
    patterns = [
        r'\$[\d,.]+\s*(?:billion|million|B|M)?',  # Dollar amounts
        r'\d+(?:\.\d+)?%',                         # Percentages
        r'\d+(?:\.\d+)?\s*(?:billion|million|B|M)', # Number with unit
        r'(?<!\w)\d{2,}(?:\.\d+)?(?!\w)',           # Standalone numbers (2+ digits)
    ]
    numbers = []
    for pat in patterns:
        matches = re.findall(pat, text, re.IGNORECASE)
        numbers.extend(matches)
    return numbers


def _number_in_evidence(num_str: str, evidence_numbers: list[str], full_evidence: str) -> bool:
    """Check if a number from a claim appears in the evidence."""
    # Direct match
    num_clean = num_str.strip().lower()
    if num_clean in full_evidence:
        return True

    # Try to match the numeric value
    num_val = _parse_numeric(num_clean)
    if num_val is not None:
        for ev_num in evidence_numbers:
            ev_val = _parse_numeric(ev_num.strip().lower())
            if ev_val is not None and abs(num_val - ev_val) < 0.01:
                return True

    return False


def _parse_numeric(s: str) -> Optional[float]:
    """Parse a numeric string to float."""
    try:
        # Remove $, commas, %, B, M, etc.
        cleaned = re.sub(r'[\$,]', '', s)
        cleaned = re.sub(r'\s*(billion|B)\s*$', 'e9', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*(million|M)\s*$', 'e6', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'%\s*$', '', cleaned)
        return float(cleaned)
    except (ValueError, TypeError):
        return None


# ────────────────────────────────────────────────
# Call C: Capability Claim Classification (local)
# ────────────────────────────────────────────────

def classify_capability_claims_local(
    claims: list[dict],
    trace: Trace,
) -> list[Finding]:
    """
    Local capability claim classifier. Checks if capability claims
    have matching tool calls.

    Catches indirect claims like "the issue was resolved", "performance improved to".
    In production, replaced by LLM Call C.
    """
    findings = []
    tool_calls = trace.all_tool_calls()
    tool_names = {tc.tool_name.lower() for tc in tool_calls}

    for claim in claims:
        if claim["claim_type"] != "capability":
            continue

        claim_text = claim["claim_text"].lower()
        turn_idx = claim["turn_index"]

        # Check for matching tool calls at or before this turn
        relevant_tools = [tc for tc in tool_calls if tc.turn_index <= turn_idx]

        if not relevant_tools:
            findings.append(Finding(
                finding_id=f"sem_capability_{claim['claim_id']}",
                category="capability_overclaim",
                verdict=Verdict.UNSUPPORTED,
                finding_source=FindingSource.SEMANTIC,
                severity=Severity.HIGH,
                turn_index=turn_idx,
                claim_text=claim["claim_text"],
                explanation=(
                    f"Capability claim '{claim['claim_text'][:60]}...' has no "
                    f"matching tool calls in the trace."
                ),
                confidence=0.8,
                semantic_call="C",
            ))

    return findings


# ────────────────────────────────────────────────
# Call D: Drift Assessment (local)
# ────────────────────────────────────────────────

def assess_drift_local(trace: Trace) -> list[Finding]:
    """
    Local drift assessment. Checks if the agent's answer addresses
    the user's actual question.

    In production, replaced by LLM Call D.
    """
    findings = []

    user_request = trace.user_request.lower()
    if not user_request:
        user_msgs = [m for m in trace.messages if m.role == "user"]
        if user_msgs:
            user_request = user_msgs[0].content.lower()

    if not user_request:
        return findings

    # Extract key terms from user request
    request_terms = _extract_key_terms(user_request)
    if len(request_terms) < 2:
        return findings

    # Only check substantive assistant messages (skip short transitional ones)
    substantive_msgs = [
        m for m in trace.assistant_messages()
        if len(m.content) > 80 and not m.tool_calls
    ]
    if not substantive_msgs:
        return findings

    # Check the last substantive message (the actual answer)
    msg = substantive_msgs[-1]
    answer_lower = msg.content.lower()

    # Check how many request terms appear in the answer
    matched_terms = sum(1 for term in request_terms if term in answer_lower)
    match_ratio = matched_terms / len(request_terms) if request_terms else 1.0

    # Check if tool outputs contained the answer but agent ignored them
    tool_outputs_for_turn = [
        tc.outputs for tc in trace.all_tool_calls()
        if tc.turn_index <= msg.turn_index and tc.outputs
    ]

    answer_has_tool_data = False
    tool_has_answer = False
    for output in tool_outputs_for_turn:
        output_lower = output.lower()
        # Check if tool output contains terms the user asked about
        tool_matched = sum(1 for term in request_terms if term in output_lower)
        if tool_matched > len(request_terms) * 0.5:
            tool_has_answer = True
        # Check if agent actually used data from this tool output
        output_terms = _extract_key_terms(output_lower)
        answer_used = sum(1 for term in output_terms if term in answer_lower)
        if answer_used > len(output_terms) * 0.3:
            answer_has_tool_data = True

    # Drift detection logic
    # Disable drift if there are no claims and no tool outputs (likely transformation or formatting task)
    if not trace.all_tool_calls() and not extract_claims_local(trace):
        return findings

    if match_ratio < 0.3 and len(request_terms) >= 2:
        drift_level = "material"
    elif match_ratio < 0.5 and tool_has_answer and not answer_has_tool_data:
        drift_level = "material"
    elif match_ratio < 0.6:
        drift_level = "minor"
    else:
        drift_level = "none"

    scope_violation = tool_has_answer and not answer_has_tool_data

    if drift_level == "material": 
        findings.append(Finding(
            finding_id=f"sem_drift_{msg.turn_index}",
            category="context_drift",
            verdict=Verdict.POLICY_VIOLATION,
            finding_source=FindingSource.SEMANTIC,
            severity=Severity.MEDIUM if not scope_violation else Severity.HIGH,
            turn_index=msg.turn_index,
            claim_text=msg.content[:100] + "..." if len(msg.content) > 100 else msg.content,
            explanation=(
                f"Agent's response does not address the user's question. "
                f"Key terms match ratio: {match_ratio:.0%}."
                + (f" Tool output contained relevant data that was not used."
                   if scope_violation else "")
            ),
            confidence=0.75,
            semantic_call="D",
        ))

    return findings


def _extract_key_terms(text: str) -> list[str]:
    """Extract meaningful terms from text for comparison."""
    # Remove common stop words and extract content words
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'and', 'but', 'or', 'not', 'no',
        'if', 'then', 'so', 'than', 'too', 'very', 'just', 'about', 'up',
        'out', 'that', 'this', 'these', 'those', 'it', 'its', 'my', 'your',
        'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
        'me', 'you', 'he', 'she', 'we', 'they', 'them', 'i',
    }
    words = re.findall(r'\b[a-z]+\b', text)
    terms = [w for w in words if w not in stop_words and len(w) > 2]
    return terms


# ────────────────────────────────────────────────
# Call E: Contradiction Detection (local)
# ────────────────────────────────────────────────

def detect_contradictions_local(
    claims: list[dict],
    trace: Trace,
) -> list[Finding]:
    """
    Local contradiction detection. Compares claims against evidence
    for factual conflicts.

    Catches: number mismatches, status inversions, factual conflicts.
    Only flags contradictions when the same metric is stated differently.
    In production, replaced by LLM Call E.
    """
    findings = []
    context_text = trace.context_text()
    tool_outputs = [tc.outputs for tc in trace.all_tool_calls() if tc.outputs]
    all_evidence = context_text + " " + " ".join(tool_outputs)

    if not all_evidence.strip():
        return findings

    for claim in claims:
        if claim["claim_type"] not in ("factual", "reference"):
            continue

        claim_text = claim["claim_text"]
        turn_idx = claim["turn_index"]

        # Check for number contradictions — only when numbers appear
        # in the claim that are NOT in the evidence but a SIMILAR number IS
        claim_numbers = _extract_numbers(claim_text)
        evidence_numbers = _extract_numbers(all_evidence)

        for cn in claim_numbers:
            cn_val = _parse_numeric(cn)
            if cn_val is None:
                continue

            # First check: is this exact number (or very close) in the evidence?
            # If yes, it's supported, not contradicted.
            exact_match = False
            for en in evidence_numbers:
                en_val = _parse_numeric(en)
                if en_val is not None and cn_val != 0:
                    ratio = abs(cn_val - en_val) / max(abs(cn_val), abs(en_val))
                    if ratio < 0.02:  # Within 2% = essentially the same number
                        exact_match = True
                        break
            if exact_match:
                continue

            # Second check: is there a same-TYPE number in the evidence that
            # significantly differs? This suggests the agent changed it.
            cn_type = _number_type(cn)
            for en in evidence_numbers:
                en_val = _parse_numeric(en)
                if en_val is None:
                    continue

                en_type = _number_type(en)
                if cn_type != en_type:
                    continue

                # Skip bare number-vs-number comparisons — too ambiguous
                # Only flag contradictions for typed numbers (%, $, etc.)
                if cn_type == "number" and en_type == "number":
                    continue

                # Same type, different value — check if they're in the same
                # magnitude range (prevents matching $4.2B against 65%)
                if cn_val != 0 and en_val != 0:
                    magnitude_ratio = max(cn_val, en_val) / min(cn_val, en_val)
                    if magnitude_ratio > 10:  # Too different in scale
                        continue

                    ratio = abs(cn_val - en_val) / max(abs(cn_val), abs(en_val))
                    if ratio > 0.1:  # More than 10% different
                        findings.append(Finding(
                            finding_id=f"sem_contradiction_{claim['claim_id']}",
                            category="contradiction",
                            verdict=Verdict.CONTRADICTED,
                            finding_source=FindingSource.SEMANTIC,
                            severity=Severity.HIGH if ratio > 0.2 else Severity.MEDIUM,
                            turn_index=turn_idx,
                            claim_text=claim_text,
                            explanation=(
                                f"Claim states '{cn}' but evidence contains '{en}' "
                                f"(same type '{cn_type}', discrepancy: {ratio:.0%})."
                            ),
                            evidence_refs=[EvidenceRef(
                                evidence_type="context",
                                ref_id="evidence_number_mismatch",
                                span_text=en,
                            )],
                            confidence=0.9,
                            semantic_call="E",
                        ))
                        break  # One contradiction per claim

    return findings


def _number_type(num_str: str) -> str:
    """Classify the type of a number string."""
    if '$' in num_str or 'dollar' in num_str.lower():
        return "currency"
    if '%' in num_str:
        return "percentage"
    if any(u in num_str.lower() for u in ['billion', 'million', 'B', 'M']):
        return "large_number"
    return "number"


# ────────────────────────────────────────────────
# Orchestrator: Run all semantic calls
# ────────────────────────────────────────────────


# ────────────────────────────────────────────────
# NEW CONTROL ENTRYPOINTS
# ────────────────────────────────────────────────

from typing import List, Dict, Any
import asyncio
from packages.semantic_calls.router import get_semantic_plan, create_semantic_runner
from packages.adapters.gemini import create_gemini_adapter
from packages.adapters.base import (
    ClaimClassification,
    CapabilityClassification,
    DriftAssessment,
    ContradictionResult,
)


def run_local_semantic_checks(trace: Trace, plan: List[str]) -> List[Finding]:
    findings: List[Finding] = []
    claims = None

    if "A" in plan:
        claims = extract_claims_local(trace)

    if "B" in plan and claims:
        findings.extend(detect_unsupported_claims_local(claims, trace))

    if "C" in plan and claims:
        findings.extend(classify_capability_claims_local(claims, trace))

    if "D" in plan:
        findings.extend(assess_drift_local(trace))

    if "E" in plan and claims:
        findings.extend(detect_contradictions_local(claims, trace))

    return findings


async def run_semantic_checks_async(
    trace: Trace,
    deterministic_findings: List[Finding],
    full_mode: bool = False,
) -> Dict[str, Any]:

    plan = get_semantic_plan(trace, deterministic_findings)

    metadata = {
        "executed_calls": plan,
        "mode": "llm" if full_mode else "local",
        "blocked_verified": 0,
    }

    if not plan:
        return {"semantic_findings": [], "metadata": metadata}

    if full_mode:
        adapter = create_gemini_adapter()
        runner = create_semantic_runner(adapter)
        raw_results = await runner.execute_plan(trace, plan)
        findings = _normalize_llm_results(raw_results)
    else:
        findings = run_local_semantic_checks(trace, plan)

    for f in findings:
        if f.verdict == Verdict.VERIFIED:
            f.verdict = Verdict.INSUFFICIENT_EVIDENCE
            metadata["blocked_verified"] += 1

    # Suppress drift when contradiction exists on same turn
    turns_with_contra = {f.turn_index for f in findings if f.category == "contradiction"}
    findings = [f for f in findings if not (f.category == "context_drift" and f.turn_index in turns_with_contra)]

    return {"semantic_findings": findings, "metadata": metadata}


def run_semantic_checks(
    trace: Trace,
    deterministic_findings: List[Finding],
    full_mode: bool = False,
) -> Dict[str, Any]:
    return asyncio.run(
        run_semantic_checks_async(trace, deterministic_findings, full_mode)
    )


def _normalize_llm_results(raw_results: List[Any]) -> List[Finding]:
    findings: List[Finding] = []
    # Build claim_id -> claim_text map from any Call A-like payloads
    claim_text_map = {}
    for item in raw_results:
        # Case 1: dict-like payload
        if isinstance(item, dict):
            if 'claim_id' in item and 'claim_text' in item:
                claim_text_map[item['claim_id']] = item['claim_text']
        else:
            # Case 2: object-like payload with attributes
            claim_id = getattr(item, 'claim_id', None)
            claim_text = getattr(item, 'claim_text', None)
            if claim_id and claim_text:
                claim_text_map[claim_id] = claim_text


    for item in raw_results:

        if isinstance(item, ClaimClassification):
            if item.classification in ("unsupported", "insufficient_evidence"):
                # Force insufficient_evidence to unsupported for unsupported_claim category
                verdict = Verdict.UNSUPPORTED if item.classification in ("unsupported", "insufficient_evidence") else Verdict.UNSUPPORTED
                findings.append(Finding(
                    finding_id=f"llm_unsupported_{item.claim_id}",
                    category="unsupported_claim",
                    verdict=verdict,
                    finding_source=FindingSource.SEMANTIC,
                    severity=Severity.HIGH,
                    turn_index=0,
                    claim_text=claim_text_map.get(item.claim_id, f"Claim ID: {item.claim_id}"),
                    explanation=f"LLM classified claim as '{item.classification}'",
                    confidence=item.confidence,
                    semantic_call="B",
                ))

        elif isinstance(item, CapabilityClassification):
            if item.requires_runtime_proof and not item.has_matching_tool_call:
                findings.append(Finding(
                    finding_id=f"llm_capability_{item.claim_id}",
                    category="capability_overclaim",
                    verdict=Verdict.UNSUPPORTED,
                    finding_source=FindingSource.SEMANTIC,
                    severity=Severity.HIGH,
                    turn_index=0,
                    claim_text=claim_text_map.get(item.claim_id, f"Claim ID: {item.claim_id}"),
                    explanation="Capability claim requires runtime proof but no matching tool call found.",
                    confidence=item.confidence,
                    semantic_call="C",
                ))

        elif isinstance(item, DriftAssessment):
            if item.drift == "material":
                findings.append(Finding(
                    finding_id="llm_drift",
                    category="context_drift",
                    verdict=Verdict.POLICY_VIOLATION,
                    finding_source=FindingSource.SEMANTIC,
                    severity=Severity.HIGH if item.scope_violation else Severity.MEDIUM,
                    turn_index=0,
                    claim_text="Material drift detected",
                    explanation=f"Drift confidence {item.confidence:.2f}",
                    confidence=item.confidence,
                    semantic_call="D",
                ))

        elif isinstance(item, ContradictionResult):
            if item.contradicted_by_refs:
                findings.append(Finding(
                    finding_id=f"llm_contradiction_{item.claim_id}",
                    category="contradiction",
                    verdict=Verdict.CONTRADICTED,
                    finding_source=FindingSource.SEMANTIC,
                    severity=Severity.HIGH,
                    turn_index=0,
                    claim_text=claim_text_map.get(item.claim_id, f"Claim ID: {item.claim_id}"),
                    explanation=f"Contradicted by {len(item.contradicted_by_refs)} refs.",
                    evidence_refs=[
                        EvidenceRef(
                            evidence_type="tool_output",
                            ref_id=f"contra_{i}",
                            span_text=ref[:200],
                        )
                        for i, ref in enumerate(item.contradicted_by_refs)
                    ],
                    confidence=item.confidence,
                    semantic_call="E",
                ))

    return findings
