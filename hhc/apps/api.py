"""
Hallucination Health Check — FastAPI Service

V3.1 Section 9: Wrap the CLI in FastAPI.
Endpoints: /run, /health, /version, /schema, /benchmark

Run:
    uvicorn apps.api:app --host 0.0.0.0 --port 8000

Or:
    python apps/api.py
"""

from __future__ import annotations
import json
import sys
import os
import asyncio
import time
from pathlib import Path
from dataclasses import asdict
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from packages.schemas.models import (
    Trace, VerdictReport, Verdict, ObservabilityTier,
    to_json, SchemaEncoder,
)
from packages.parser.trace_loader import parse_trace
from packages.deterministic_checks.checks import run_all_deterministic_checks
from packages.semantic_calls.orchestrator import run_semantic_checks_async
from packages.adjudicator.engine import assemble_verdict

# ────────────────────────────────────────────────
# Check if FastAPI is available, provide fallback
# ────────────────────────────────────────────────

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

VERSION = "1.0.0"
SCHEMA_VERSION = "1.0.0"


def create_app() -> "FastAPI":
    """Create and configure the FastAPI application."""
    if not HAS_FASTAPI:
        raise ImportError(
            "FastAPI is required for the API service. "
            "Install with: pip install fastapi uvicorn"
        )

    app = FastAPI(
        title="Hallucination Health Check",
        description=(
            "A deterministic-first verification harness that proves tool use "
            "and evidence binding, then emits observability-tier-aware verdicts."
        ),
        version=VERSION,
    )

    # ────────────────────────────────────────────
    # POST /run — Run verification on a trace
    # ────────────────────────────────────────────

    @app.post("/run")
    async def run_check(request: Request):
        """
        Run the verification pipeline against a trace.

        Accepts a trace JSON object in the request body.
        Returns a structured VerdictReport.

        Query params:
            mode: "deterministic" | "full" | "post_hoc" (default: "deterministic")
        """
        start_time = time.time()

        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

        # Parse trace
        try:
            trace = parse_trace(body)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse trace: {str(e)}"
            )

        # Determine mode
        mode = request.query_params.get("mode", "deterministic")
        if mode not in ("deterministic", "full", "post_hoc"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode '{mode}'. Use: deterministic, full, post_hoc"
            )

        # Stage 2: Deterministic checks (always run)
        findings = run_all_deterministic_checks(trace)

        # Stage 3: Semantic checks (if mode requires it)
        if mode in ("full", "post_hoc"):
            semantic_result = await run_semantic_checks_async(
                trace,
                findings,
                full_mode=True,
            )
            semantic_findings = semantic_result["semantic_findings"]

            # Suppress duplicates
            related_categories = {
                "capability_overclaim": {"tool_bypass", "capability_overclaim"},
                "tool_bypass": {"tool_bypass", "capability_overclaim"},
                "unsupported_claim": {"citation_fabrication", "unsupported_claim"},
            }
            for sf in semantic_findings:
                related = related_categories.get(sf.category, {sf.category})
                already_caught = any(
                    f.turn_index == sf.turn_index and f.category in related
                    for f in findings
                )
                if not already_caught:
                    findings.append(sf)

        # Stage 4: Verdict assembly
        pipeline_mode = {
            "deterministic": "deterministic",
            "full": "inline_soft_gate",
            "post_hoc": "post_hoc",
        }[mode]

        verdict = assemble_verdict(trace, findings, pipeline_mode=pipeline_mode)

        elapsed = time.time() - start_time

        # Build response
        response = json.loads(to_json(verdict))
        response["_meta"] = {
            "elapsed_ms": round(elapsed * 1000, 1),
            "mode": mode,
            "api_version": VERSION,
        }

        return JSONResponse(content=response)

    # ────────────────────────────────────────────
    # GET /health — Health check
    # ────────────────────────────────────────────

    @app.get("/health")
    async def health():
        """Service health check."""
        has_api_key = bool(os.environ.get("HHC_GEMINI_API_KEY", ""))
        return {
            "status": "healthy",
            "version": VERSION,
            "schema_version": SCHEMA_VERSION,
            "llm_adapter": "gemini" if has_api_key else "local_heuristics",
            "modes_available": (
                ["deterministic", "full", "post_hoc"]
                if has_api_key
                else ["deterministic", "full (local heuristics)"]
            ),
        }

    # ────────────────────────────────────────────
    # GET /version — Version info
    # ────────────────────────────────────────────

    @app.get("/version")
    async def version():
        """Return version information."""
        return {
            "api_version": VERSION,
            "schema_version": SCHEMA_VERSION,
            "checker_version": VERSION,
            "policy_version": SCHEMA_VERSION,
        }

    # ────────────────────────────────────────────
    # GET /schema — Return schema definitions
    # ────────────────────────────────────────────

    @app.get("/schema")
    async def schema():
        """Return the verdict and trace schema definitions."""
        return {
            "verdict_taxonomy": [v.value for v in Verdict],
            "observability_tiers": {
                str(t.value): t.name for t in ObservabilityTier
            },
            "trace_schema_version": SCHEMA_VERSION,
            "verdict_fields": [
                "trace_id", "overall_verdict", "observability_tier",
                "findings", "skipped_checks", "summary",
                "checker_version", "policy_version",
                "trace_schema_version", "timestamp",
                "pipeline_mode", "models_used",
            ],
            "finding_fields": [
                "finding_id", "category", "verdict", "finding_source",
                "severity", "turn_index", "claim_text", "explanation",
                "evidence_refs", "confidence", "semantic_call",
            ],
        }

    # ────────────────────────────────────────────
    # GET /metrics — Basic metrics
    # ────────────────────────────────────────────

    _request_count = {"total": 0, "deterministic": 0, "full": 0, "post_hoc": 0}
    _verdict_counts = {v.value: 0 for v in Verdict}

    @app.middleware("http")
    async def track_metrics(request: Request, call_next):
        response = await call_next(request)
        if request.url.path == "/run" and request.method == "POST":
            _request_count["total"] += 1
            mode = request.query_params.get("mode", "deterministic")
            _request_count[mode] = _request_count.get(mode, 0) + 1
        return response

    @app.get("/metrics")
    async def metrics():
        """Basic request metrics."""
        return {
            "requests": _request_count,
            "verdicts": _verdict_counts,
        }

    return app


# ────────────────────────────────────────────────
# Create app instance (for uvicorn)
# ────────────────────────────────────────────────

if HAS_FASTAPI:
    app = create_app()
else:
    app = None


# ────────────────────────────────────────────────
# Standalone runner
# ────────────────────────────────────────────────

if __name__ == "__main__":
    if not HAS_FASTAPI:
        print("FastAPI is required. Install with: pip install fastapi uvicorn")
        print("For now, use the CLI: python -m apps.cli check <trace.json>")
        sys.exit(1)

    import uvicorn
    port = int(os.environ.get("HHC_PORT", "8000"))
    host = os.environ.get("HHC_HOST", "0.0.0.0")
    print(f"Starting Hallucination Health Check API on {host}:{port}")
    uvicorn.run("apps.api:app", host=host, port=port, reload=True)
