"""
Tier-aware adjudicator — the core policy engine.

V3.1 Section 6: Combines findings, applies observability-tier logic,
resolves conflicts, and returns final verdicts.

Hard rules enforced here:
- Deterministic findings outrank semantic findings
- No semantic-only "verified" verdicts
- A Tier 2 "verified" is not equivalent to a Tier 0 "verified"
- Must expose what it cannot know
"""

from __future__ import annotations
from packages.schemas.models import (
    Trace, Finding, VerdictReport, VerdictSummary, SkippedCheck,
    Verdict, ObservabilityTier, FindingSource, Severity,
)


def determine_observability_tier(trace: Trace) -> ObservabilityTier:
    """
    Determine the current observability tier based on available evidence.
    """
    has_runtime_spans = bool(trace.runtime_spans)
    has_tool_calls = bool(trace.all_tool_calls())
    has_messages = bool(trace.messages)
    has_artifacts = bool(trace.artifacts)
    has_context = bool(trace.context_blocks)

    # Tier 0: Full runtime instrumentation
    if has_runtime_spans and has_tool_calls and has_messages:
        return ObservabilityTier.TIER_0

    # Tier 1: Partial runtime visibility
    if has_runtime_spans and has_messages:
        return ObservabilityTier.TIER_1

    # Tier 2: Transcript + tool calls + citations
    if has_messages and (has_tool_calls or has_context):
        return ObservabilityTier.TIER_2

    # Tier 3: Output only
    return ObservabilityTier.TIER_3


def compute_skipped_checks(tier: ObservabilityTier) -> list[SkippedCheck]:
    """Determine which checks were skipped or downgraded due to tier."""
    skipped = []

    if tier.value >= 3:
        skipped.append(SkippedCheck(
            check_name="tool_call_existence",
            reason="No tool call data available at Tier 3",
            would_require_tier=2,
        ))
        skipped.append(SkippedCheck(
            check_name="citation_existence",
            reason="No context or tool output data at Tier 3",
            would_require_tier=2,
        ))
        skipped.append(SkippedCheck(
            check_name="tool_output_contradiction",
            reason="No tool outputs available at Tier 3",
            would_require_tier=2,
        ))
        skipped.append(SkippedCheck(
            check_name="required_tool_policy",
            reason="Cannot verify tool usage at Tier 3",
            would_require_tier=2,
        ))

    if tier.value >= 2:
        skipped.append(SkippedCheck(
            check_name="runtime_span_binding",
            reason="No runtime spans available at Tier 2",
            would_require_tier=0,
        ))
        skipped.append(SkippedCheck(
            check_name="artifact_hash_verification",
            reason="No runtime artifact hashes at Tier 2",
            would_require_tier=0,
        ))

    if tier.value >= 1:
        skipped.append(SkippedCheck(
            check_name="full_execution_proof",
            reason="Partial runtime visibility at Tier 1",
            would_require_tier=0,
        ))

    return skipped


def compute_overall_verdict(findings: list[Finding]) -> Verdict:
    """
    Compute the overall verdict from all findings.

    Priority order:
    1. CONTRADICTED (any contradiction = fail)
    2. POLICY_VIOLATION (any policy violation = fail)
    3. UNSUPPORTED (any unsupported claim = warn)
    4. INSUFFICIENT_EVIDENCE
    5. UNVERIFIABLE_AT_TIER
    6. VERIFIED (only if all claims are verified)
    """
    if not findings:
        return Verdict.VERIFIED

    verdicts = {f.verdict for f in findings}

    if Verdict.CONTRADICTED in verdicts:
        return Verdict.CONTRADICTED
    if Verdict.POLICY_VIOLATION in verdicts:
        return Verdict.POLICY_VIOLATION
    if Verdict.UNSUPPORTED in verdicts:
        return Verdict.UNSUPPORTED
    if Verdict.INSUFFICIENT_EVIDENCE in verdicts:
        return Verdict.INSUFFICIENT_EVIDENCE
    if Verdict.UNVERIFIABLE_AT_TIER in verdicts:
        return Verdict.UNVERIFIABLE_AT_TIER

    return Verdict.VERIFIED


def compute_summary(findings: list[Finding]) -> VerdictSummary:
    """Compute summary statistics from findings."""
    summary = VerdictSummary()
    summary.total_claims_extracted = len(findings)

    for f in findings:
        if f.verdict == Verdict.VERIFIED:
            summary.claims_verified += 1
        elif f.verdict == Verdict.UNSUPPORTED:
            summary.claims_unsupported += 1
        elif f.verdict == Verdict.CONTRADICTED:
            summary.claims_contradicted += 1
        elif f.verdict == Verdict.INSUFFICIENT_EVIDENCE:
            summary.claims_insufficient_evidence += 1
        elif f.verdict == Verdict.UNVERIFIABLE_AT_TIER:
            summary.claims_unverifiable += 1
        elif f.verdict == Verdict.POLICY_VIOLATION:
            summary.policy_violations += 1

        if f.finding_source == FindingSource.DETERMINISTIC:
            summary.deterministic_findings += 1
        else:
            summary.semantic_findings += 1

    return summary


def apply_tier_downgrades(
    findings: list[Finding],
    tier: ObservabilityTier,
) -> list[Finding]:
    """
    Downgrade findings that cannot be fully verified at the current tier.

    Rule: do not silently upgrade a weak-evidence case into "verified."
    """
    adjusted = []
    for f in findings:
        # If a finding claims "verified" but we're at a low tier
        # and it was semantic-only, downgrade it
        if (f.verdict == Verdict.VERIFIED
                and f.finding_source == FindingSource.SEMANTIC
                and tier.value >= 2):
            # Hard rule: no semantic-only verified verdicts
            f = Finding(
                finding_id=f.finding_id,
                category=f.category,
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                finding_source=f.finding_source,
                severity=f.severity,
                turn_index=f.turn_index,
                claim_text=f.claim_text,
                explanation=f.explanation + (
                    " [Downgraded: semantic-only verification at "
                    f"Tier {tier.value} is not sufficient for 'verified' status.]"
                ),
                evidence_refs=f.evidence_refs,
                confidence=f.confidence,
                semantic_call=f.semantic_call,
            )
        adjusted.append(f)
    return adjusted


def assemble_verdict(
    trace: Trace,
    findings: list[Finding],
    pipeline_mode: str = "deterministic",
    models_used: list[str] | None = None,
) -> VerdictReport:
    """
    Final verdict assembly. V3.1 Step 6.

    Combines all findings, applies tier logic, and emits the structured verdict.
    """
    tier = determine_observability_tier(trace)
    skipped = compute_skipped_checks(tier)

    # Apply tier downgrades
    adjusted_findings = apply_tier_downgrades(findings, tier)

    # Compute overall verdict
    overall = compute_overall_verdict(adjusted_findings)

    # Compute summary
    summary = compute_summary(adjusted_findings)

    return VerdictReport(
        trace_id=trace.trace_id,
        overall_verdict=overall,
        observability_tier=tier,
        findings=adjusted_findings,
        skipped_checks=skipped,
        summary=summary,
        pipeline_mode=pipeline_mode,
        models_used=models_used or [],
    )
