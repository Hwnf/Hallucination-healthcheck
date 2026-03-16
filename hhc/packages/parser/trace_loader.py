"""
Trace loader and parser.
Converts raw JSON conversation files into canonical Trace objects.

V3.1 Step 3: Parse the conversation into a normalized internal trace object.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

from packages.schemas.models import (
    Trace, Message, ToolCall, Citation, ContextBlock,
    Artifact, GroundTruth, GroundTruthFinding,
)


def load_trace(path: str | Path) -> Trace:
    """Load a trace from a JSON file."""
    path = Path(path)
    with open(path) as f:
        data = json.load(f)
    return parse_trace(data)


def parse_trace(data: dict) -> Trace:
    """Parse a raw dict into a canonical Trace object."""
    messages = []
    for msg_data in data.get("messages", []):
        tool_calls = [
            ToolCall(
                tool_call_id=tc.get("tool_call_id", f"tc_{i}"),
                tool_name=tc.get("tool_name", ""),
                inputs=tc.get("inputs", {}),
                outputs=tc.get("outputs"),
                timestamp=tc.get("timestamp"),
                turn_index=msg_data.get("turn_index", 0),
            )
            for i, tc in enumerate(msg_data.get("tool_calls", []))
        ]

        citations = [
            Citation(
                citation_id=c.get("citation_id", f"cite_{i}"),
                source_text=c.get("source_text", ""),
                referenced_in_turn=msg_data.get("turn_index", 0),
                context_present=c.get("context_present", False),
                artifact_ref=c.get("artifact_ref"),
            )
            for i, c in enumerate(msg_data.get("citations", []))
        ]

        messages.append(Message(
            turn_index=msg_data.get("turn_index", 0),
            role=msg_data.get("role", "unknown"),
            content=msg_data.get("content", ""),
            tool_calls=tool_calls,
            tool_results=msg_data.get("tool_results", []),
            citations=citations,
            timestamp=msg_data.get("timestamp"),
        ))

    context_blocks = [
        ContextBlock(
            context_id=cb.get("context_id", f"ctx_{i}"),
            content=cb.get("content", ""),
            source=cb.get("source", "unknown"),
            turn_index=cb.get("turn_index", 0),
        )
        for i, cb in enumerate(data.get("context_blocks", []))
    ]

    artifacts = [
        Artifact(
            artifact_id=a.get("artifact_id", f"art_{i}"),
            artifact_type=a.get("artifact_type", "unknown"),
            content_hash=a.get("content_hash"),
            source_trace_id=a.get("source_trace_id"),
            created_at=a.get("created_at"),
        )
        for i, a in enumerate(data.get("artifacts", []))
    ]

    ground_truth = None
    gt_data = data.get("ground_truth")
    if gt_data:
        gt_findings = [
            GroundTruthFinding(
                finding_id=f.get("finding_id", f"gt_{i}"),
                category=f.get("category", ""),
                turn_index=f.get("turn_index", 0),
                span_text=f.get("span_text", ""),
                severity=f.get("severity", "medium"),
                explanation=f.get("explanation", ""),
                evidence_proving_hallucination=f.get("evidence_proving_hallucination", ""),
                required_tier=f.get("required_tier", 2),
                expected_verdict=f.get("expected_verdict", "unsupported"),
            )
            for i, f in enumerate(gt_data.get("findings", []))
        ]
        ground_truth = GroundTruth(
            is_clean=gt_data.get("is_clean", False),
            findings=gt_findings,
            reviewer=gt_data.get("reviewer"),
            second_reviewer=gt_data.get("second_reviewer"),
            review_date=gt_data.get("review_date"),
        )

    return Trace(
        trace_id=data.get("trace_id", "unknown"),
        trace_schema_version=data.get("trace_schema_version", "1.0.0"),
        session_id=data.get("session_id"),
        agent_id=data.get("agent_id"),
        user_request=data.get("user_request", ""),
        system_instructions=data.get("system_instructions"),
        messages=messages,
        context_blocks=context_blocks,
        artifacts=artifacts,
        runtime_spans=data.get("runtime_spans", []),
        metadata=data.get("metadata", {}),
        ground_truth=ground_truth,
    )
