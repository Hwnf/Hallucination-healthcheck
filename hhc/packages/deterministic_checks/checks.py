"""
Deterministic checks — Stage 2 of the pipeline.

V3.1 Section 8, Step 3: tool-call existence, citation existence,
required-tool policy, schema validation, keyword triggers, and
transcript-vs-tool-output contradictions.

These run as code. No LLM calls. Binary pass/fail findings with
the highest trust level.
"""

from __future__ import annotations
import re
from typing import Optional

from packages.schemas.models import (
    Trace, Finding, EvidenceRef, Verdict, FindingSource, Severity,
    CapabilityVerb,
)


# ────────────────────────────────────────────────
# Check 1: Tool-Call Existence
# ────────────────────────────────────────────────

# Patterns that indicate an agent claims to have used a tool
TOOL_CLAIM_PATTERNS = [
    (r'\b(?:I |i )?searched (?:the web|online|for|google)', "web_search"),
    (r'\b(?:I |i )?(?:ran|executed|running) (?:the |a )?(?:code|script|command|test|simulation)', "code_execution"),
    (r'\b(?:I |i )?(?:fetched|retrieved|pulled|downloaded) .{0,40}?(?:page|url|website|data|file|content|article|post|document)', "web_fetch"),
    (r'\b(?:I |i )?(?:read|opened|loaded|parsed) .{0,30}?(?:file|document|pdf|csv|config|yaml|json|txt)', "file_read"),
    (r'\b(?:I |i )?(?:wrote|saved|created|generated) .{0,30}?(?:file|document|output|report)', "file_write"),
    (r'\b(?:I |i )?(?:queried|looked up|checked) .{0,30}?(?:database|api|endpoint|service|health)', "api_call"),
    (r'\b(?:I |i )?(?:calculated|computed|evaluated)', "computation"),
]


def check_tool_call_existence(trace: Trace) -> list[Finding]:
    """
    For every agent statement that references a tool action,
    verify a corresponding tool invocation and result exists in the trace.
    """
    findings = []
    actual_tool_names = {tc.tool_name for tc in trace.all_tool_calls()}
    actual_tool_calls = trace.all_tool_calls()

    for msg in trace.assistant_messages():
        for pattern, expected_tool_type in TOOL_CLAIM_PATTERNS:
            matches = list(re.finditer(pattern, msg.content, re.IGNORECASE))
            for match in matches:
                # Check if any tool call exists near this message
                relevant_calls = [
                    tc for tc in actual_tool_calls
                    if tc.turn_index <= msg.turn_index
                ]

                # Look for a tool call that matches the claimed action
                has_matching_call = False
                matching_ref = None
                for tc in relevant_calls:
                    tool_lower = tc.tool_name.lower()
                    if _tool_matches_claim(tool_lower, expected_tool_type):
                        has_matching_call = True
                        matching_ref = EvidenceRef(
                            evidence_type="tool_call",
                            ref_id=tc.tool_call_id,
                            turn_index=tc.turn_index,
                        )
                        break

                if not has_matching_call:
                    span = match.group(0)
                    findings.append(Finding(
                        finding_id=f"tool_bypass_{msg.turn_index}_{match.start()}",
                        category="tool_bypass",
                        verdict=Verdict.UNSUPPORTED,
                        finding_source=FindingSource.DETERMINISTIC,
                        severity=Severity.HIGH,
                        turn_index=msg.turn_index,
                        claim_text=span,
                        explanation=(
                            f"Agent claims '{span}' but no matching tool call "
                            f"of type '{expected_tool_type}' exists in the trace."
                        ),
                    ))

    return findings


def _tool_matches_claim(tool_name: str, expected_type: str) -> bool:
    """Check if a tool name matches an expected tool type."""
    type_keywords = {
        "web_search": ["search", "web", "google", "bing", "browse"],
        "code_execution": ["code", "exec", "run", "python", "bash", "shell", "compute"],
        "web_fetch": ["fetch", "http", "url", "get", "download", "browse", "web"],
        "file_read": ["read", "file", "open", "load", "parse", "document"],
        "file_write": ["write", "save", "create", "file", "output"],
        "api_call": ["api", "query", "database", "db", "endpoint", "service"],
        "computation": ["calc", "compute", "math", "eval"],
    }
    keywords = type_keywords.get(expected_type, [])
    return any(kw in tool_name for kw in keywords)


# ────────────────────────────────────────────────
# Check 2: Citation Existence
# ────────────────────────────────────────────────

# Patterns for citation-like references in text
CITATION_PATTERNS = [
    r'(?:according to|as (?:stated|noted|reported|described) (?:in|by))\s+["\u201c]?([^"\u201d\n]{5,80})["\u201d]?',
    r'(?:source|reference|citation):\s*(.+?)(?:\.|$)',
    r'\[(\d+)\]',  # Numbered references like [1], [2]
    r'(?:from|per|see)\s+(?:the\s+)?["\u201c]([^"\u201d\n]{5,80})["\u201d]',
]


def check_citation_existence(trace: Trace) -> list[Finding]:
    """
    Verify that cited sources actually exist in the provided context
    or tool outputs.
    """
    findings = []
    context_text = trace.context_text().lower()
    tool_outputs = " ".join(
        tc.outputs.lower() for tc in trace.all_tool_calls() if tc.outputs
    )
    available_text = context_text + " " + tool_outputs

    # Check explicit citation objects
    for cite in trace.all_citations():
        if not cite.context_present:
            source_lower = cite.source_text.lower()
            if source_lower not in available_text:
                findings.append(Finding(
                    finding_id=f"citation_missing_{cite.citation_id}",
                    category="citation_fabrication",
                    verdict=Verdict.UNSUPPORTED,
                    finding_source=FindingSource.DETERMINISTIC,
                    severity=Severity.HIGH,
                    turn_index=cite.referenced_in_turn,
                    claim_text=f"Citation: {cite.source_text}",
                    explanation=(
                        f"Citation '{cite.source_text}' is referenced but does not "
                        f"appear in any provided context or tool output."
                    ),
                ))

    return findings


# ────────────────────────────────────────────────
# Check 3: Required-Tool Policy
# ────────────────────────────────────────────────

# Task patterns that require specific tools
REQUIRED_TOOL_POLICIES = [
    {
        "pattern": r'(?:current|latest|today|right now|as of|recent)\b.*\b(?:price|stock|weather|news|score|result)',
        "required_tool": "web_search",
        "description": "Current/real-time information requires web search",
    },
    {
        "pattern": r'(?:run|execute|test|compile|evaluate)\s+(?:this|the|my)\s+(?:code|script|program)',
        "required_tool": "code_execution",
        "description": "Code execution request requires code execution tool",
    },
    {
        "pattern": r'(?:read|open|analyze|parse|look at)\s+(?:this|the|my)\s+(?:file|document|pdf|spreadsheet|csv)',
        "required_tool": "file_read",
        "description": "File analysis request requires file read tool",
    },
]


def check_required_tool_policy(trace: Trace) -> list[Finding]:
    """
    Given a task type, verify the expected tool was invoked.
    Does NOT fire if the agent honestly declines or says it can't help.
    """
    findings = []
    actual_tool_names = {tc.tool_name.lower() for tc in trace.all_tool_calls()}
    user_request = trace.user_request.lower()

    # Also check user messages
    user_texts = [m.content for m in trace.messages if m.role == "user"]
    all_user_text = " ".join(user_texts).lower()
    check_text = user_request + " " + all_user_text

    # Check if the agent declined or admitted inability
    assistant_text = " ".join(m.content.lower() for m in trace.assistant_messages())
    decline_patterns = [
        r"(?:don't|do not|cannot|can't) have access",
        r"(?:unable|not able) to",
        r"(?:don't|do not) have (?:real-time|current|live)",
        r"i (?:can't|cannot) (?:access|check|verify|retrieve)",
        r"(?:recommend|suggest) (?:checking|visiting|using)",
        r"(?:no access|not available)",
    ]
    agent_declined = any(
        re.search(pat, assistant_text) for pat in decline_patterns
    )

    for policy in REQUIRED_TOOL_POLICIES:
        if re.search(policy["pattern"], check_text, re.IGNORECASE):
            required = policy["required_tool"]
            has_tool = any(
                _tool_matches_claim(name, required)
                for name in actual_tool_names
            )
            if not has_tool and not agent_declined:
                findings.append(Finding(
                    finding_id=f"policy_{required}",
                    category="policy_violation",
                    verdict=Verdict.POLICY_VIOLATION,
                    finding_source=FindingSource.DETERMINISTIC,
                    severity=Severity.MEDIUM,
                    turn_index=0,
                    claim_text=f"Task requires {required}",
                    explanation=(
                        f"{policy['description']}, but no matching tool call "
                        f"was found in the trace."
                    ),
                ))

    return findings


# ────────────────────────────────────────────────
# Check 4: Schema Validation
# ────────────────────────────────────────────────

def check_schema_compliance(trace: Trace) -> list[Finding]:
    """Validate trace structure matches expected format."""
    findings = []

    if not trace.trace_id or trace.trace_id == "unknown":
        findings.append(Finding(
            finding_id="schema_missing_trace_id",
            category="schema_violation",
            verdict=Verdict.POLICY_VIOLATION,
            finding_source=FindingSource.DETERMINISTIC,
            severity=Severity.LOW,
            turn_index=0,
            claim_text="Missing trace_id",
            explanation="Trace is missing a valid trace_id.",
        ))

    if not trace.messages:
        findings.append(Finding(
            finding_id="schema_no_messages",
            category="schema_violation",
            verdict=Verdict.POLICY_VIOLATION,
            finding_source=FindingSource.DETERMINISTIC,
            severity=Severity.HIGH,
            turn_index=0,
            claim_text="No messages in trace",
            explanation="Trace contains no messages to verify.",
        ))

    if not trace.user_request and not any(m.role == "user" for m in trace.messages):
        findings.append(Finding(
            finding_id="schema_no_user_request",
            category="schema_violation",
            verdict=Verdict.POLICY_VIOLATION,
            finding_source=FindingSource.DETERMINISTIC,
            severity=Severity.MEDIUM,
            turn_index=0,
            claim_text="No user request found",
            explanation="Trace has no user_request field and no user messages.",
        ))

    # Check for tool calls with missing outputs
    for tc in trace.all_tool_calls():
        if tc.outputs is None:
            findings.append(Finding(
                finding_id=f"schema_tool_no_output_{tc.tool_call_id}",
                category="schema_violation",
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                finding_source=FindingSource.DETERMINISTIC,
                severity=Severity.LOW,
                turn_index=tc.turn_index,
                claim_text=f"Tool call '{tc.tool_name}' has no output",
                explanation=f"Tool call {tc.tool_call_id} ({tc.tool_name}) has no recorded output.",
            ))

    return findings


# ────────────────────────────────────────────────
# Check 5: Keyword Trigger Scanner
# ────────────────────────────────────────────────

CAPABILITY_PATTERNS = [
    # Direct verb forms
    r'\b[Ii]\s+(?:ran|simulated|executed|tested|verified|searched|measured|benchmarked'
    r'|updated|confirmed|validated|checked|proved|deployed|resolved|fixed)\b',
    # Past tense passive
    r'\b(?:was|were|been)\s+(?:tested|verified|validated|confirmed|executed|measured|benchmarked'
    r'|deployed|resolved|checked)\b',
    # Indirect forms (the hardest to catch)
    r'\b(?:results?\s+(?:were|was)\s+confirmed)',
    r'\b(?:was\s+validated\s+experimentally)',
    r'\b(?:database\s+now\s+reflects)',
    r'\b(?:numbers?\s+(?:were|was)\s+checked)',
    r'\b(?:performance\s+improved\s+to)',
    r'\b(?:after\s+deploying\s+the\s+fix)',
    r'\b(?:the\s+issue\s+was\s+resolved)',
    r'\b(?:tests?\s+(?:passed|succeeded|completed))',
]


def scan_keyword_triggers(trace: Trace) -> list[Finding]:
    """
    Flag responses containing high-risk action verbs for Stage 3 evaluation.
    These are not verdicts — they are flags for the semantic layer.

    Does NOT flag phrases that appear in the agent's source context or
    tool outputs (the agent is reporting, not claiming).
    """
    findings = []
    # Build a lowercase version of all context + tool outputs
    context_lower = trace.context_text().lower()
    tool_output_text = " ".join(
        tc.outputs.lower() for tc in trace.all_tool_calls() if tc.outputs
    )
    source_text = context_lower + " " + tool_output_text

    for msg in trace.assistant_messages():
        for pattern in CAPABILITY_PATTERNS:
            matches = list(re.finditer(pattern, msg.content, re.IGNORECASE))
            for match in matches:
                span = match.group(0)
                span_lower = span.lower()

                # Skip if this phrase appears in the source context/tool output
                # (agent is reporting what the source says, not claiming an action)
                if span_lower in source_text:
                    continue

                # Also skip if the key action verb appears in the source context
                # (e.g., context says "launch confirmed" and agent says "was confirmed")
                action_verbs = re.findall(
                    r'\b(?:confirmed|verified|validated|tested|executed|deployed|resolved'
                    r'|checked|proved|searched|measured|benchmarked|fixed|updated)\b',
                    span_lower
                )
                if action_verbs and any(v in source_text for v in action_verbs):
                    continue

                # Check if there's a corresponding tool call
                relevant_calls = [
                    tc for tc in trace.all_tool_calls()
                    if tc.turn_index <= msg.turn_index
                ]
                if not relevant_calls:
                    findings.append(Finding(
                        finding_id=f"keyword_trigger_{msg.turn_index}_{match.start()}",
                        category="capability_overclaim",
                        verdict=Verdict.UNSUPPORTED,
                        finding_source=FindingSource.DETERMINISTIC,
                        severity=Severity.HIGH,
                        turn_index=msg.turn_index,
                        claim_text=span,
                        explanation=(
                            f"Capability claim '{span}' detected with no tool calls "
                            f"at or before turn {msg.turn_index} to support it."
                        ),
                    ))

    return findings


# ────────────────────────────────────────────────
# Check 6: Obvious Contradictions
# ────────────────────────────────────────────────

def check_tool_output_contradictions(trace: Trace) -> list[Finding]:
    """
    Detect obvious contradictions between tool outputs and agent claims.
    This checks for cases where a tool output contains one value
    and the agent claims a different value.
    """
    findings = []

    for msg in trace.assistant_messages():
        # Find tool calls that happened before this message
        prior_tool_calls = [
            tc for tc in trace.all_tool_calls()
            if tc.turn_index < msg.turn_index and tc.outputs
        ]

        for tc in prior_tool_calls:
            output_lower = tc.outputs.lower() if tc.outputs else ""

            # Check for explicit negation contradictions
            # e.g., tool says "error" but agent says "succeeded"
            contradiction_pairs = [
                (r'\b(?:error|failed|failure|exception|crash)\b',
                 r'\b(?:succeeded|successful|passed|works?|working)\b'),
                (r'\b(?:not found|no results?|empty|none|null)\b',
                 r'\b(?:found|results? show|contains?|returned)\b'),
                (r'\b(?:false|denied|rejected|invalid)\b',
                 r'\b(?:true|approved|accepted|valid)\b'),
            ]

            for negative_pattern, positive_pattern in contradiction_pairs:
                output_has_negative = re.search(negative_pattern, output_lower)
                claim_has_positive = re.search(positive_pattern, msg.content.lower())

                if output_has_negative and claim_has_positive:
                    findings.append(Finding(
                        finding_id=f"contradiction_{msg.turn_index}_{tc.tool_call_id}",
                        category="contradiction",
                        verdict=Verdict.CONTRADICTED,
                        finding_source=FindingSource.DETERMINISTIC,
                        severity=Severity.CRITICAL,
                        turn_index=msg.turn_index,
                        claim_text=claim_has_positive.group(0),
                        explanation=(
                            f"Agent claims '{claim_has_positive.group(0)}' but tool "
                            f"'{tc.tool_name}' output contains '{output_has_negative.group(0)}'."
                        ),
                        evidence_refs=[EvidenceRef(
                            evidence_type="tool_output",
                            ref_id=tc.tool_call_id,
                            turn_index=tc.turn_index,
                            span_text=output_has_negative.group(0),
                        )],
                    ))

    return findings


# ────────────────────────────────────────────────
# Runner: Execute all deterministic checks
# ────────────────────────────────────────────────

def run_all_deterministic_checks(trace: Trace) -> list[Finding]:
    """Run all Stage 2 deterministic checks and return combined findings."""
    all_findings = []

    all_findings.extend(check_schema_compliance(trace))
    all_findings.extend(check_tool_call_existence(trace))
    all_findings.extend(check_citation_existence(trace))
    all_findings.extend(check_required_tool_policy(trace))
    all_findings.extend(scan_keyword_triggers(trace))
    all_findings.extend(check_tool_output_contradictions(trace))

    # Deduplicate by finding_id
    seen_ids = set()
    deduped = []
    for f in all_findings:
        if f.finding_id not in seen_ids:
            seen_ids.add(f.finding_id)
            deduped.append(f)

    # Smart suppression: if tool_bypass caught a claim on a given turn,
    # suppress keyword_trigger and policy_violation findings on the same turn
    # that are less specific about the same issue.
    tool_bypass_turns = {
        f.turn_index for f in deduped if f.category == "tool_bypass"
    }
    suppressed = []
    for f in deduped:
        if f.category == "capability_overclaim" and f.turn_index in tool_bypass_turns:
            # Keyword trigger is redundant when tool_bypass already caught it
            continue
        if (f.category == "policy_violation"
                and f.turn_index == 0
                and any(tb.turn_index <= 1 for tb in deduped if tb.category == "tool_bypass")):
            # Policy violation about missing required tool is redundant
            # when tool_bypass already flagged the specific claim
            continue
        suppressed.append(f)

    return suppressed
