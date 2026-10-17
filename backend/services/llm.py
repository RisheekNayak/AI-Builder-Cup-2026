"""Single entry point to Gemini (google-genai SDK). Callers handle LLMUnavailable and fall back to deterministic logic."""
import json
import asyncio
import logging
import os
import time
from backend import config

logger = logging.getLogger(__name__)
COOLDOWN_SECONDS = 300
_disabled_until = 0.0
_last_error: str | None = None


class LLMUnavailable(RuntimeError):
    pass


_shared_client = None


def provider() -> str:
    return "developer_api" if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") else "vertex_ai"


def _client():
    """One long-lived client: a temporary one is garbage-collected and closes its HTTP session mid-request."""
    global _shared_client
    if _shared_client is None:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        _shared_client = genai.Client(api_key=api_key) if api_key else \
            genai.Client(vertexai=True, project=config.GCP_PROJECT_ID, location=config.GEMINI_LOCATION)
    return _shared_client


def enabled() -> bool:
    if os.environ.get("ASSISTANT_MODE", "auto").lower() == "offline":
        return False
    return time.time() >= _disabled_until


def status() -> dict:
    return {"available": enabled(), "model": config.GEMINI_MODEL_NAME, "last_error": _last_error,
            "provider": provider(), "mode": os.environ.get("ASSISTANT_MODE", "auto").lower()}


def _mark_failed(error: Exception):
    global _disabled_until, _last_error
    permanent = any(marker in str(error) for marker in ("403", "PERMISSION_DENIED", "401", "API key not valid"))
    cooldown = COOLDOWN_SECONDS * 6 if permanent else COOLDOWN_SECONDS
    _disabled_until = time.time() + cooldown
    _last_error = str(error)[:300]
    logger.warning("Gemini unavailable, using offline mode for %ss: %s", cooldown, _last_error)


async def generate(contents, config_obj=None):
    if not enabled():
        raise LLMUnavailable(_last_error or "AI is turned off (ASSISTANT_MODE=offline).")
    started = time.monotonic()
    try:
        response = await asyncio.wait_for(
            _client().aio.models.generate_content(model=config.GEMINI_MODEL_NAME, contents=contents, config=config_obj),
            timeout=45,
        )
        logger.info("gemini provider=%s model=%s outcome=success latency_ms=%s", provider(),
                    config.GEMINI_MODEL_NAME, round((time.monotonic() - started) * 1000))
        return response
    except Exception as error:  # SDK raises many error types (auth, quota, network)
        _mark_failed(error)
        raise LLMUnavailable(str(error)) from error


async def generate_json(contents) -> dict:
    from google.genai import types
    response = await generate(contents, types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
    text = (response.text or "").strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise LLMUnavailable(f"The AI returned unreadable data: {error}") from error


async def extract_document(file_bytes: bytes, mime_type: str, instructions: str) -> dict:
    from google.genai import types
    return await generate_json([types.Part.from_bytes(data=file_bytes, mime_type=mime_type), instructions])


async def generate_text(prompt: str) -> str:
    response = await generate(prompt)
    return (response.text or "").strip()
