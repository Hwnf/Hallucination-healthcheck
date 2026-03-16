"""
Gemini adapter — concrete implementation of SemanticAdapter.

Implements the provider-agnostic adapter interface for Google Gemini models.
Handles API authentication, request formatting, structured JSON response
parsing, error handling, and retry logic.

Usage:
    adapter = GeminiAdapter(api_key=os.environ["HHC_GEMINI_API_KEY"])
    result = await adapter.call(semantic_call_input)

Or configure via environment variable:
    export HHC_GEMINI_API_KEY="your-gemini-api-key"

Or point to a key file:
    export HHC_GEMINI_KEY_FILE="/path/to/key/file"

Model assignments (V3.1 Section 10):
    Call A (claim extraction):          gemini-3.1-flash-lite  thinking: minimal
    Call B (unsupported claim detection): gemini-3-flash        thinking: medium
    Call C (capability classification):  gemini-3-flash         thinking: medium
    Call D (drift assessment):           gemini-3.1-flash-lite  thinking: medium
    Call E inline (contradiction):       gemini-3.1-flash-lite  thinking: high
    Call E post-hoc (contradiction):     gemini-1.5-pro         thinking: high
"""

from __future__ import annotations
import json
import os
import time
import asyncio
from dataclasses import dataclass, field
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from packages.adapters.base import (
    SemanticAdapter, SemanticCallInput, SemanticCallResult,
    ExtractedClaim, ClaimClassification, CapabilityClassification,
    DriftAssessment, ContradictionResult,
)

# Import prompts
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from prompts.system_prompts import PROMPTS


# ────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────

@dataclass
class GeminiConfig:
    @classmethod
    def from_env(cls) -> "GeminiConfig":
        key = os.environ.get("HHC_GEMINI_API_KEY")

        if not key:
            secret_path = os.environ.get("HHC_GEMINI_KEY_FILE", "")
            if secret_path:
                try:
                    with open(secret_path, "r") as f:
                        key = f.read().strip()
                except FileNotFoundError:
                    key = None

        if not key:
            raise RuntimeError(
                "Gemini API key not found. Set HHC_GEMINI_API_KEY environment variable, "
                "or set HHC_GEMINI_KEY_FILE to the path of a file containing the key."
            )

        return cls(
            api_key=key,
            post_hoc_mode=os.environ.get("HHC_POST_HOC", "").lower() == "true",
        )

    """Configuration for the Gemini adapter."""
    api_key: str = ""
    base_url: str = "https://generativelanguage.googleapis.com/v1"
    max_retries: int = 3
    retry_delay: float = 1.0
    timeout: int = 30
    post_hoc_mode: bool = False  # Use Pro model for Call E

    # Model assignments per call type
    models: dict = field(default_factory=lambda: {
        "A": "gemini-2.5-flash",
        "B": "gemini-2.5-flash",
        "C": "gemini-2.5-flash",
        "D": "gemini-2.5-flash",
        "E": "gemini-2.5-flash",
        "E_post_hoc": "gemini-2.5-flash",
    })

    # Thinking level mapping to Gemini thinking config
    thinking_budgets: dict = field(default_factory=lambda: {
        "minimal": 256,
        "low": 1024,
        "medium": 4096,
        "high": 8192,
    })

    def update_models_for_latest(self):
        """
        Update model strings to latest available versions.
        Call this when Gemini 3.1 models move from preview to stable.
        """
        self.models = {
            "A": "gemini-3.1-flash-lite",
            "B": "gemini-3-flash",
            "C": "gemini-3-flash",
            "D": "gemini-3.1-flash-lite",
            "E": "gemini-3.1-flash-lite",
            "E_post_hoc": "gemini-3.1-pro",
        }


# ────────────────────────────────────────────────
# Gemini Adapter
# ────────────────────────────────────────────────

class GeminiAdapter(SemanticAdapter):
    """
    Concrete Gemini implementation of the SemanticAdapter interface.

    All provider-specific logic lives here: API authentication,
    request formatting, response parsing, error handling, retry logic.
    """

    def __init__(self, api_key: str = "", config: Optional[GeminiConfig] = None):
        self.config = config or GeminiConfig.from_env()
        if api_key:
            self.config.api_key = api_key
        if not self.config.api_key:
            raise ValueError(
                "Gemini API key required. Set HHC_GEMINI_API_KEY env var "
                "or pass api_key parameter."
            )

    def provider_name(self) -> str:
        return "gemini"

    def model_for_call(self, call_type: str) -> str:
        if call_type == "E" and self.config.post_hoc_mode:
            return self.config.models.get("E_post_hoc", self.config.models["E"])
        return self.config.models.get(call_type, "gemini-2.0-flash-lite")

    async def call(self, input: SemanticCallInput) -> SemanticCallResult:
        """Execute a semantic call through the Gemini API."""
        model = self.model_for_call(input.call_type)
        system_prompt = PROMPTS.get(input.call_type, "")

        if not system_prompt:
            return SemanticCallResult(
                call_type=input.call_type,
                success=False,
                error=f"No system prompt defined for call type '{input.call_type}'",
            )

        # Build the user message from call-specific data
        user_message = self._build_user_message(input)

        # Build the API request body
        request_body = self._build_request_body(
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            thinking_level=input.thinking_level,
            max_tokens=input.max_tokens,
        )

        # Execute with retries
        for attempt in range(self.config.max_retries):
            try:
                response = await self._send_request(model, request_body)
                parsed = self._parse_response(input.call_type, response)

                return SemanticCallResult(
                    call_type=input.call_type,
                    success=True,
                    raw_output=response.get("_raw_text", ""),
                    parsed=parsed,
                    model_used=model,
                    tokens_input=response.get("usageMetadata", {}).get("promptTokenCount", 0),
                    tokens_output=response.get("usageMetadata", {}).get("candidatesTokenCount", 0),
                )

            except RetryableError as e:
                if attempt < self.config.max_retries - 1:
                    delay = self.config.retry_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
                    continue
                return SemanticCallResult(
                    call_type=input.call_type,
                    success=False,
                    error=f"Failed after {self.config.max_retries} retries: {str(e)}",
                    model_used=model,
                )

            except Exception as e:
                return SemanticCallResult(
                    call_type=input.call_type,
                    success=False,
                    error=str(e),
                    model_used=model,
                )

    # ────────────────────────────────────────────
    # Request Building
    # ────────────────────────────────────────────

    def _build_user_message(self, input: SemanticCallInput) -> str:
        """Build the user message from call-specific data."""
        data = input.data

        if input.call_type == "A":
            return (
                f"ANSWER TEXT (turn {data.get('turn_index', 0)}):\n"
                f"{data.get('answer_text', '')}\n\n"
                f"AVAILABLE CONTEXT:\n"
                f"{data.get('context_text', '(none)')}"
            )

        elif input.call_type == "B":
            claims_str = json.dumps(data.get("claims", []), indent=2)
            evidence_str = "\n".join(data.get("evidence_snippets", []))
            tools_str = ", ".join(data.get("tool_inventory", []))
            cites_str = ", ".join(data.get("citation_inventory", []))
            return (
                f"CLAIMS TO CHECK:\n{claims_str}\n\n"
                f"AVAILABLE EVIDENCE:\n{evidence_str or '(none)'}\n\n"
                f"TOOL INVENTORY: {tools_str or '(none)'}\n"
                f"CITATION INVENTORY: {cites_str or '(none)'}"
            )

        elif input.call_type == "C":
            claims_str = json.dumps(data.get("capability_claims", []), indent=2)
            tools_str = json.dumps(data.get("tool_call_log", []), indent=2)
            return (
                f"CAPABILITY CLAIMS:\n{claims_str}\n\n"
                f"TOOL CALL LOG:\n{tools_str}"
            )

        elif input.call_type == "D":
            outputs_str = "\n---\n".join(data.get("tool_outputs", []))
            return (
                f"USER REQUEST:\n{data.get('user_request', '')}\n\n"
                f"SYSTEM INSTRUCTIONS:\n{data.get('system_instructions', '(none)')}\n\n"
                f"AGENT ANSWER:\n{data.get('answer_text', '')}\n\n"
                f"TOOL OUTPUTS:\n{outputs_str or '(none)'}"
            )

        elif input.call_type == "E":
            claims_str = json.dumps(data.get("claims", []), indent=2)
            outputs_str = "\n---\n".join(data.get("tool_outputs", []))
            evidence_str = "\n---\n".join(data.get("cited_evidence", []))
            return (
                f"CLAIMS:\n{claims_str}\n\n"
                f"TOOL OUTPUTS:\n{outputs_str or '(none)'}\n\n"
                f"CITED EVIDENCE:\n{evidence_str or '(none)'}"
            )

        return json.dumps(data, indent=2)

    def _build_request_body(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        thinking_level: str,
        max_tokens: int,
    ) -> dict:
        full_prompt = f"{system_prompt}\n\n{user_message}"
        return {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": full_prompt}
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": max_tokens or 2048,
            },
        }
    async def _send_request(self, model: str, body: dict) -> dict:
        """Send request to Gemini API and return parsed response."""
        url = (
            f"{self.config.base_url}/models/{model}:generateContent"
            f"?key={self.config.api_key}"
        )

        json_body = json.dumps(body).encode("utf-8")

        req = Request(
            url,
            data=json_body,
            headers={
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            # Run synchronous urllib in executor to not block event loop
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: urlopen(req, timeout=self.config.timeout),
            )
            response_data = json.loads(response.read().decode("utf-8"))

        except HTTPError as e:
            status = e.code
            error_body = e.read().decode("utf-8") if e.readable() else ""

            if status == 429:
                raise RetryableError(f"Rate limited (429): {error_body}")
            elif status >= 500:
                raise RetryableError(f"Server error ({status}): {error_body}")
            else:
                raise AdapterError(f"API error ({status}): {error_body}")

        except URLError as e:
            raise RetryableError(f"Network error: {str(e)}")

        # Extract text from response
        candidates = response_data.get("candidates", [])
        if not candidates:
            raise AdapterError("No candidates in Gemini response")

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])

        # Find the text part (skip thinking parts)
        raw_text = ""
        for part in parts:
            if "text" in part and "thought" not in part:
                raw_text = part["text"]
                break

        response_data["_raw_text"] = raw_text
        return response_data

    # ────────────────────────────────────────────
    # Response Parsing
    # ────────────────────────────────────────────

    def _parse_response(self, call_type: str, response: dict) -> any:
        """Parse the raw API response into typed output objects."""
        raw_text = response.get("_raw_text", "")

        # Clean up common LLM output issues
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise AdapterError(
                f"Failed to parse JSON from Call {call_type}: {str(e)}\n"
                f"Raw output: {raw_text[:500]}"
            )

        if call_type == "A":
            return self._parse_call_a(data)
        elif call_type == "B":
            return self._parse_call_b(data)
        elif call_type == "C":
            return self._parse_call_c(data)
        elif call_type == "D":
            return self._parse_call_d(data)
        elif call_type == "E":
            return self._parse_call_e(data)
        else:
            return data

    def _parse_call_a(self, data: list | dict) -> list[ExtractedClaim]:
        """Parse Call A: Claim extraction."""
        if isinstance(data, dict):
            data = data.get("claims", [data])
        if not isinstance(data, list):
            data = [data]

        claims = []
        for item in data:
            if not isinstance(item, dict):
                continue
            claims.append(ExtractedClaim(
                claim_id=item.get("claim_id", f"c{len(claims)+1}"),
                claim_text=item.get("claim_text", ""),
                claim_type=item.get("claim_type", "factual"),
                turn_index=item.get("turn_index", 0),
                evidence_refs=item.get("evidence_refs", []),
            ))
        return claims

    def _parse_call_b(self, data: list | dict) -> list[ClaimClassification]:
        """Parse Call B: Unsupported claim detection."""
        if isinstance(data, dict):
            data = data.get("classifications", [data])
        if not isinstance(data, list):
            data = [data]

        results = []
        for item in data:
            if not isinstance(item, dict):
                continue
            results.append(ClaimClassification(
                claim_id=item.get("claim_id", ""),
                classification=item.get("classification", "insufficient_evidence"),
                rationale_span_refs=item.get("rationale_span_refs", []),
                confidence=float(item.get("confidence", 0.0)),
            ))
        return results

    def _parse_call_c(self, data: list | dict) -> list[CapabilityClassification]:
        """Parse Call C: Capability claim classification."""
        if isinstance(data, dict):
            data = data.get("capability_claims", [data])
        if not isinstance(data, list):
            data = [data]

        results = []
        for item in data:
            if not isinstance(item, dict):
                continue
            results.append(CapabilityClassification(
                claim_id=item.get("claim_id", ""),
                capability_type=item.get("capability_type", "unknown"),
                requires_runtime_proof=item.get("requires_runtime_proof", True),
                has_matching_tool_call=item.get("has_matching_tool_call", False),
                confidence=float(item.get("confidence", 0.0)),
            ))
        return results

    def _parse_call_d(self, data: dict) -> DriftAssessment:
        """Parse Call D: Drift assessment."""
        if isinstance(data, list):
            data = data[0] if data else {}

        return DriftAssessment(
            drift=data.get("drift", "none"),
            scope_violation=data.get("scope_violation", False),
            offending_spans=data.get("offending_spans", []),
            confidence=float(data.get("confidence", 0.0)),
        )

    def _parse_call_e(self, data: list | dict) -> list[ContradictionResult]:
        """Parse Call E: Contradiction detection."""
        if isinstance(data, dict):
            data = data.get("contradictions", [data])
        if not isinstance(data, list):
            data = [data]

        results = []
        for item in data:
            if not isinstance(item, dict):
                continue
            results.append(ContradictionResult(
                claim_id=item.get("claim_id", ""),
                contradicted_by_refs=item.get("contradicted_by_refs", []),
                severity=item.get("severity", "medium"),
                confidence=float(item.get("confidence", 0.0)),
            ))
        return results


# ────────────────────────────────────────────────
# Exceptions
# ────────────────────────────────────────────────

class AdapterError(Exception):
    """Non-retryable adapter error."""
    pass


class RetryableError(Exception):
    """Retryable error (rate limit, server error, network)."""
    pass


# ────────────────────────────────────────────────
# Convenience constructor
# ────────────────────────────────────────────────

def create_gemini_adapter(
    api_key: str = "",
    post_hoc: bool = False,
    use_latest_models: bool = False,
) -> GeminiAdapter:
    """
    Create a configured Gemini adapter.

    Args:
        api_key: Gemini API key. Falls back to HHC_GEMINI_API_KEY env var.
        post_hoc: If True, use Pro model for Call E (contradiction detection).
        use_latest_models: If True, use Gemini 3.1 model strings (preview).
    """
    config = GeminiConfig.from_env()
    if api_key:
        config.api_key = api_key
    config.post_hoc_mode = post_hoc
    if use_latest_models:
        config.update_models_for_latest()
    return GeminiAdapter(config=config)
