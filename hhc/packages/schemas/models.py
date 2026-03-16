"""
Canonical schemas for the Hallucination Health Check pipeline.
V3.1 — Receipt Checker / Future-Resilient Scope

These schemas define the data contracts between all pipeline stages.
Do not begin adapter or parser work until these schemas stop moving.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
import json
import hashlib
from datetime import datetime


# ────────────────────────────────────────────────
# Enums
# ────────────────────────────────────────────────

class Verdict(str, Enum):
    """Six-way verdict taxonomy from V3.1 Section 5."""
    VERIFIED = "verified"
    UNSUPPORTED = "unsupported"
    CONTRADICTED = "contradicted"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    UNVERIFIABLE_AT_TIER = "unverifiable_at_tier"
    POLICY_VIOLATION = "policy_violation"


class ObservabilityTier(int, Enum):
    """Tiers 0-3 from V3.1 Section 6."""
    TIER_0 = 0  # Full runtime instrumentation
    TIER_1 = 1  # Partial runtime visibility
    TIER_2 = 2  # Transcript + tool calls + citations
    TIER_3 = 3  # Final output only


class FindingSource(str, Enum):
    """Whether a finding came from deterministic logic or semantic analysis."""
    DETERMINISTIC = "deterministic"
    SEMANTIC = "semantic"


class ClaimType(str, Enum):
    """Classification of extracted claims."""
    FACTUAL = "factual"           # Names, numbers, dates, versions
    CAUSAL = "causal"             # X caused Y
    CAPABILITY = "capability"     # Agent claims it did something
    REFERENCE = "reference"       # Citation or source reference
    CONCLUSION = "conclusion"     # Derived conclusion


class CapabilityVerb(str, Enum):
    """High-risk action verbs that trigger provenance verification."""
    RAN = "ran"
    SIMULATED = "simulated"
    EXECUTED = "executed"
    TESTED = "tested"
    VERIFIED = "verified"
    SEARCHED = "searched"
    MEASURED = "measured"
    BENCHMARKED = "benchmarked"
    UPDATED = "updated"
    CONFIRMED = "confirmed"
    VALIDATED = "validated"
    CHECKED = "checked"
    PROVED = "proved"
    DEPLOYED = "deployed"
    RESOLVED = "resolved"
    FIXED = "fixed"


class DriftLevel(str, Enum):
    NONE = "none"
    MINOR = "minor"
    MATERIAL = "material"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ────────────────────────────────────────────────
# Trace Schema
# ────────────────────────────────────────────────

@dataclass
class ToolCall:
    """A tool invocation within the conversation."""
    tool_call_id: str
    tool_name: str
    inputs: dict = field(default_factory=dict)
    outputs: Optional[str] = None
    timestamp: Optional[str] = None
    turn_index: int = 0


@dataclass
class Citation:
    """A reference to a source within the conversation."""
    citation_id: str
    source_text: str
    referenced_in_turn: int
    context_present: bool = False  # Whether source is in available context
    artifact_ref: Optional[str] = None


@dataclass
class Artifact:
    """An artifact produced or referenced during the conversation."""
    artifact_id: str
    artifact_type: str  # file, url, code_output, api_response, etc.
    content_hash: Optional[str] = None
    source_trace_id: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class Message:
    """A single message in the conversation."""
    turn_index: int
    role: str  # user, assistant, system, tool
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[dict] = field(default_factory=list)
    citations: list[Citation] = field(default_factory=list)
    timestamp: Optional[str] = None


@dataclass
class ContextBlock:
    """A block of context provided to the agent."""
    context_id: str
    content: str
    source: str  # retrieved, user_provided, system, tool_output
    turn_index: int = 0


@dataclass
class Trace:
    """
    Canonical trace schema. V3.1 Step 1.

    Covers: messages, tool calls, tool outputs, timestamps, citations,
    artifacts, runtime spans when available, and a ground_truth block
    for benchmark traces.
    """
    trace_id: str
    trace_schema_version: str = "1.0.0"
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    user_request: str = ""
    system_instructions: Optional[str] = None
    messages: list[Message] = field(default_factory=list)
    context_blocks: list[ContextBlock] = field(default_factory=list)
    artifacts: list[Artifact] = field(default_factory=list)
    runtime_spans: list[dict] = field(default_factory=list)  # OTel spans when available
    metadata: dict = field(default_factory=dict)
    ground_truth: Optional[GroundTruth] = None

    def all_tool_calls(self) -> list[ToolCall]:
        """Extract all tool calls across all messages."""
        calls = []
        for msg in self.messages:
            calls.extend(msg.tool_calls)
        return calls

    def all_citations(self) -> list[Citation]:
        """Extract all citations across all messages."""
        cites = []
        for msg in self.messages:
            cites.extend(msg.citations)
        return cites

    def assistant_messages(self) -> list[Message]:
        """Get only assistant messages."""
        return [m for m in self.messages if m.role == "assistant"]

    def context_text(self) -> str:
        """Concatenate all context blocks."""
        return "\n".join(cb.content for cb in self.context_blocks)

    def tool_output_for(self, tool_name: str) -> list[str]:
        """Get all outputs from a specific tool."""
        return [
            tc.outputs for tc in self.all_tool_calls()
            if tc.tool_name == tool_name and tc.outputs
        ]


# ────────────────────────────────────────────────
# Ground Truth (for benchmark traces)
# ────────────────────────────────────────────────

@dataclass
class GroundTruthFinding:
    """An annotated hallucination in a benchmark trace."""
    finding_id: str
    category: str  # tool_bypass, citation_fabrication, unsupported_claim,
                   # capability_overclaim, context_drift, contradiction, memory_corruption
    turn_index: int
    span_text: str  # The specific text that is hallucinated
    severity: str   # low, medium, high, critical
    explanation: str  # Why this is a hallucination
    evidence_proving_hallucination: str  # What proves this is wrong
    required_tier: int = 2  # Minimum tier needed to detect this
    expected_verdict: str = "unsupported"


@dataclass
class GroundTruth:
    """Ground truth annotations for benchmark evaluation."""
    is_clean: bool = False  # True if no hallucinations
    findings: list[GroundTruthFinding] = field(default_factory=list)
    reviewer: Optional[str] = None
    second_reviewer: Optional[str] = None
    review_date: Optional[str] = None


# ────────────────────────────────────────────────
# Findings Schema
# ────────────────────────────────────────────────

@dataclass
class EvidenceRef:
    """Reference to a specific piece of evidence."""
    evidence_type: str  # tool_call, tool_output, citation, context, artifact, runtime_span
    ref_id: str
    turn_index: Optional[int] = None
    span_text: Optional[str] = None
    content_hash: Optional[str] = None


@dataclass
class Finding:
    """A single finding from the verification pipeline."""
    finding_id: str
    category: str  # tool_bypass, citation_missing, unsupported_claim,
                   # capability_overclaim, context_drift, contradiction,
                   # policy_violation, keyword_trigger
    verdict: Verdict
    finding_source: FindingSource
    severity: Severity
    turn_index: int
    claim_text: str
    explanation: str
    evidence_refs: list[EvidenceRef] = field(default_factory=list)
    confidence: Optional[float] = None  # Only for semantic findings
    semantic_call: Optional[str] = None  # Which call produced this (A/B/C/D/E)


# ────────────────────────────────────────────────
# Verdict Schema
# ────────────────────────────────────────────────

@dataclass
class SkippedCheck:
    """A check that was skipped or downgraded due to observability constraints."""
    check_name: str
    reason: str
    would_require_tier: int


@dataclass
class VerdictSummary:
    """Summary statistics for the verdict."""
    total_claims_extracted: int = 0
    claims_verified: int = 0
    claims_unsupported: int = 0
    claims_contradicted: int = 0
    claims_insufficient_evidence: int = 0
    claims_unverifiable: int = 0
    policy_violations: int = 0
    deterministic_findings: int = 0
    semantic_findings: int = 0


@dataclass
class VerdictReport:
    """
    Canonical verdict schema. V3.1 Step 1.

    Includes: overall verdict, finding list, finding_source per finding,
    observability_tier, evidence references, skipped checks, and
    confidence/explanation fields where needed.
    """
    trace_id: str
    overall_verdict: Verdict
    observability_tier: ObservabilityTier
    findings: list[Finding] = field(default_factory=list)
    skipped_checks: list[SkippedCheck] = field(default_factory=list)
    summary: VerdictSummary = field(default_factory=VerdictSummary)
    checker_version: str = "1.0.0"
    policy_version: str = "1.0.0"
    trace_schema_version: str = "1.0.0"
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    pipeline_mode: str = "deterministic"  # deterministic, inline_soft_gate, post_hoc
    models_used: list[str] = field(default_factory=list)

    def has_failures(self) -> bool:
        return self.overall_verdict in (
            Verdict.CONTRADICTED,
            Verdict.POLICY_VIOLATION,
        )

    def has_warnings(self) -> bool:
        return self.overall_verdict in (
            Verdict.UNSUPPORTED,
            Verdict.INSUFFICIENT_EVIDENCE,
            Verdict.UNVERIFIABLE_AT_TIER,
        )


# ────────────────────────────────────────────────
# Serialization
# ────────────────────────────────────────────────

class SchemaEncoder(json.JSONEncoder):
    """JSON encoder that handles dataclasses, enums, and datetimes."""
    def default(self, obj):
        if hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def to_json(obj, indent: int = 2) -> str:
    """Serialize any schema object to JSON."""
    return json.dumps(obj, cls=SchemaEncoder, indent=indent)


def content_hash(text: str) -> str:
    """Generate a content hash for artifact integrity checks."""
    return hashlib.sha256(text.encode()).hexdigest()[:16]
