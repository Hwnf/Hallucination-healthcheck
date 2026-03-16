"""
Benchmark runner and evaluation harness.

V3.1 Section 8, Step 4: Run the deterministic auditor against all labeled
traces. Measure false positives separately from true positives.

Tracks deterministic vs semantic findings separately per V3.1 Section 11.
"""

from __future__ import annotations
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict

from packages.schemas.models import (
    Trace, VerdictReport, Finding, Verdict, FindingSource, to_json,
)
from packages.parser.trace_loader import load_trace
from packages.deterministic_checks.checks import run_all_deterministic_checks
from packages.semantic_calls.orchestrator import run_semantic_checks
from packages.adjudicator.engine import assemble_verdict


@dataclass
class TraceResult:
    """Result of running the pipeline against a single trace."""
    trace_id: str
    is_clean: bool
    expected_finding_count: int
    actual_finding_count: int
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    det_true_positives: int = 0
    det_false_positives: int = 0
    sem_true_positives: int = 0
    sem_false_positives: int = 0
    verdict: str = ""
    details: list[str] = field(default_factory=list)


@dataclass
class BenchmarkReport:
    """Aggregate benchmark results."""
    total_traces: int = 0
    clean_traces: int = 0
    hallucinated_traces: int = 0
    total_true_positives: int = 0
    total_false_positives: int = 0
    total_false_negatives: int = 0
    det_true_positives: int = 0
    det_false_positives: int = 0
    sem_true_positives: int = 0
    sem_false_positives: int = 0
    precision: float = 0.0
    recall: float = 0.0
    false_positive_rate_clean: float = 0.0  # FP rate on clean traces specifically
    per_category: dict = field(default_factory=dict)
    trace_results: list[TraceResult] = field(default_factory=list)

    def compute_metrics(self):
        tp = self.total_true_positives
        fp = self.total_false_positives
        fn = self.total_false_negatives

        self.precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        self.recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0

        # FP rate on clean traces
        clean_results = [r for r in self.trace_results if r.is_clean]
        clean_fp = sum(r.false_positives for r in clean_results)
        clean_total_checks = sum(r.actual_finding_count for r in clean_results)
        # FP rate = traces with any FP / total clean traces
        clean_with_fp = sum(1 for r in clean_results if r.false_positives > 0)
        self.false_positive_rate_clean = (
            clean_with_fp / len(clean_results) if clean_results else 0.0
        )


def evaluate_trace(trace: Trace, full_pipeline: bool = False) -> TraceResult:
    """Run the pipeline against a single trace and evaluate."""
    gt = trace.ground_truth
    is_clean = gt.is_clean if gt else True
    expected_findings = gt.findings if gt else []

    # Run deterministic checks
    actual_findings = run_all_deterministic_checks(trace)

    # Run semantic checks if full pipeline
    if full_pipeline:
        semantic_findings = run_semantic_checks(trace)
        # Suppress duplicates — related categories on same turn
        related_categories = {
            "capability_overclaim": {"tool_bypass", "capability_overclaim"},
            "tool_bypass": {"tool_bypass", "capability_overclaim"},
            "unsupported_claim": {"citation_fabrication", "unsupported_claim"},
        }
        for sf in semantic_findings:
            related = related_categories.get(sf.category, {sf.category})
            already_caught = any(
                f.turn_index == sf.turn_index and f.category in related
                for f in actual_findings
            )
            if not already_caught:
                actual_findings.append(sf)

    # Build verdict
    mode = "inline_soft_gate" if full_pipeline else "deterministic"
    verdict_report = assemble_verdict(trace, actual_findings, pipeline_mode=mode)

    # Match actual findings to expected findings
    result = TraceResult(
        trace_id=trace.trace_id,
        is_clean=is_clean,
        expected_finding_count=len(expected_findings),
        actual_finding_count=len(actual_findings),
        verdict=verdict_report.overall_verdict.value,
    )

    if is_clean:
        # Every finding on a clean trace is a false positive
        result.false_positives = len(actual_findings)
        result.det_false_positives = sum(
            1 for f in actual_findings if f.finding_source == FindingSource.DETERMINISTIC
        )
        result.sem_false_positives = sum(
            1 for f in actual_findings if f.finding_source == FindingSource.SEMANTIC
        )
        for f in actual_findings:
            result.details.append(f"FP: {f.category} at turn {f.turn_index}: {f.claim_text}")
    else:
        # Match findings to ground truth
        matched_gt = set()
        matched_actual = set()

        for af in actual_findings:
            best_match = None
            for gt_f in expected_findings:
                if gt_f.finding_id in matched_gt:
                    continue
                # Match by category and turn index
                if (gt_f.category == af.category
                        and abs(gt_f.turn_index - af.turn_index) <= 1):
                    best_match = gt_f
                    break
                # Fuzzy match by turn index proximity
                if abs(gt_f.turn_index - af.turn_index) <= 1:
                    best_match = gt_f
                    break

            if best_match:
                matched_gt.add(best_match.finding_id)
                matched_actual.add(af.finding_id)
                result.true_positives += 1
                if af.finding_source == FindingSource.DETERMINISTIC:
                    result.det_true_positives += 1
                else:
                    result.sem_true_positives += 1
                result.details.append(
                    f"TP: {af.category} at turn {af.turn_index} "
                    f"matched GT {best_match.finding_id}"
                )
            else:
                result.false_positives += 1
                if af.finding_source == FindingSource.DETERMINISTIC:
                    result.det_false_positives += 1
                else:
                    result.sem_false_positives += 1
                result.details.append(
                    f"FP: {af.category} at turn {af.turn_index}: {af.claim_text}"
                )

        # Unmatched ground truth = false negatives
        for gt_f in expected_findings:
            if gt_f.finding_id not in matched_gt:
                result.false_negatives += 1
                result.details.append(
                    f"FN: missed {gt_f.category} at turn {gt_f.turn_index}: "
                    f"{gt_f.span_text}"
                )

    return result


def run_benchmark(dataset_dir: str | Path, full_pipeline: bool = False) -> BenchmarkReport:
    """Run the full benchmark against all traces in a directory."""
    dataset_dir = Path(dataset_dir)
    report = BenchmarkReport()

    # Collect all JSON files from seeded and clean subdirectories
    trace_files = []
    for subdir in ["seeded", "clean"]:
        subpath = dataset_dir / subdir
        if subpath.exists():
            trace_files.extend(sorted(subpath.glob("*.json")))

    # Also check root
    trace_files.extend(sorted(dataset_dir.glob("*.json")))

    # Deduplicate
    seen_paths = set()
    unique_files = []
    for f in trace_files:
        if f.resolve() not in seen_paths:
            seen_paths.add(f.resolve())
            unique_files.append(f)

    for trace_file in unique_files:
        trace = load_trace(trace_file)
        result = evaluate_trace(trace, full_pipeline=full_pipeline)
        report.trace_results.append(result)

        report.total_traces += 1
        if result.is_clean:
            report.clean_traces += 1
        else:
            report.hallucinated_traces += 1

        report.total_true_positives += result.true_positives
        report.total_false_positives += result.false_positives
        report.total_false_negatives += result.false_negatives
        report.det_true_positives += result.det_true_positives
        report.det_false_positives += result.det_false_positives
        report.sem_true_positives += result.sem_true_positives
        report.sem_false_positives += result.sem_false_positives

        # Track per-category using GT categories
        if trace.ground_truth and not trace.ground_truth.is_clean:
            for gt_f in trace.ground_truth.findings:
                cat = gt_f.category
                if cat not in report.per_category:
                    report.per_category[cat] = {"expected": 0, "caught": 0, "missed": 0}
                report.per_category[cat]["expected"] += 1

            # Count caught vs missed by checking GT finding IDs
            # A GT finding is "caught" if it was matched as a TP
            matched_gt_ids = set()
            for detail in result.details:
                if detail.startswith("TP:") and "matched GT " in detail:
                    gt_id = detail.split("matched GT ")[1].strip()
                    matched_gt_ids.add(gt_id)

            for gt_f in trace.ground_truth.findings:
                cat = gt_f.category
                if gt_f.finding_id in matched_gt_ids:
                    report.per_category[cat]["caught"] += 1
                else:
                    report.per_category[cat]["missed"] += 1

    report.compute_metrics()
    return report


def format_report(report: BenchmarkReport) -> str:
    """Format a benchmark report as a readable string."""
    lines = []
    lines.append("=" * 60)
    lines.append("HALLUCINATION HEALTH CHECK — BENCHMARK REPORT")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Traces evaluated:     {report.total_traces}")
    lines.append(f"  Clean:              {report.clean_traces}")
    lines.append(f"  Hallucinated:       {report.hallucinated_traces}")
    lines.append("")
    lines.append("── Aggregate Metrics ──")
    lines.append(f"True positives:       {report.total_true_positives}")
    lines.append(f"False positives:      {report.total_false_positives}")
    lines.append(f"False negatives:      {report.total_false_negatives}")
    lines.append(f"Precision:            {report.precision:.1%}")
    lines.append(f"Recall:               {report.recall:.1%}")
    lines.append(f"FP rate (clean):      {report.false_positive_rate_clean:.1%}")
    lines.append("")
    lines.append("── By Finding Source ──")
    lines.append(f"Deterministic TP:     {report.det_true_positives}")
    lines.append(f"Deterministic FP:     {report.det_false_positives}")
    lines.append(f"Semantic TP:          {report.sem_true_positives}")
    lines.append(f"Semantic FP:          {report.sem_false_positives}")
    lines.append("")

    if report.per_category:
        lines.append("── By Category ──")
        for cat, stats in sorted(report.per_category.items()):
            caught = stats["caught"]
            expected = stats["expected"]
            rate = caught / expected if expected > 0 else 0
            lines.append(f"  {cat:30s}  {caught}/{expected}  ({rate:.0%})")
        lines.append("")

    # Quality gate check
    lines.append("── Quality Gate Assessment ──")
    fp_gate = report.false_positive_rate_clean < 0.05
    lines.append(f"  FP rate < 5% on clean:      {'PASS' if fp_gate else 'FAIL'} ({report.false_positive_rate_clean:.1%})")

    # Check tool_bypass and citation detection rate
    for cat in ["tool_bypass", "citation_fabrication"]:
        if cat in report.per_category:
            stats = report.per_category[cat]
            rate = stats["caught"] / stats["expected"] if stats["expected"] > 0 else 0
            gate = rate >= 0.95
            lines.append(f"  {cat} TP > 95%:  {'PASS' if gate else 'FAIL'} ({rate:.0%})")

    lines.append("")
    lines.append("── Per-Trace Details ──")
    for tr in report.trace_results:
        status = "CLEAN" if tr.is_clean else "HALLUCINATED"
        lines.append(f"\n  [{tr.trace_id}] ({status}) verdict={tr.verdict}")
        lines.append(f"    TP={tr.true_positives} FP={tr.false_positives} FN={tr.false_negatives}")
        for detail in tr.details:
            lines.append(f"      {detail}")

    return "\n".join(lines)
