"""
Thin wrapper around an OpenAI-compatible chat-completions endpoint.

Nebius Token Factory (Nemotron), and any temporary dev provider
(OpenRouter, Groq, Together, local Ollama, ...), all speak the same
OpenAI-compatible API, so switching between them is purely a matter
of changing the AI_* variables in .env -- nothing in this file or
anywhere else in the codebase names a vendor or a model.

Everything that can go wrong here (missing config, network error,
timeout, HTTP error, empty reply) is converted into one exception
type, AIServiceError, so the view only ever has to handle one thing
and the app never crashes because an upstream AI call failed.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """The AI backend is unreachable, misconfigured, or returned nothing usable."""


def _build_client():
    # Config is checked FIRST so a missing key/URL/model always gives
    # the clear "not configured" error, even before openai is imported.
    if not settings.AI_API_KEY or not settings.AI_BASE_URL or not settings.AI_MODEL:
        logger.error(
            "AI is not configured: set AI_BASE_URL, AI_API_KEY and AI_MODEL in backend/.env"
        )
        raise AIServiceError(
            "AI is not configured: set AI_BASE_URL, AI_API_KEY and AI_MODEL in .env"
        )

    # Imported lazily so the rest of the project (and its test suite)
    # still imports cleanly even if the `openai` package is missing.
    from openai import OpenAI

    return OpenAI(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        timeout=settings.AI_TIMEOUT_SECONDS,
        # We handle retries ourselves (analysis.py retries only on
        # malformed output), so a slow/failed call never silently
        # multiplies into several billed requests.
        max_retries=0,
    )

def request_completion(system_prompt, user_prompt):
    """
    Sends one system+user message pair and returns the model's reply
    as a plain string. Raises AIServiceError on any failure.
    """
    client = _build_client()

    kwargs = {
        "model": settings.AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": settings.AI_MAX_TOKENS,
    }
    if settings.AI_JSON_MODE:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
    except AIServiceError:
        raise
    except Exception as exc:  # network, timeout, auth, rate limit, bad shape...
        # Log the exception *type* only -- messages from some SDK
        # errors can echo request details we don't want in logs.
        logger.warning("AI request failed: %s", type(exc).__name__)
        raise AIServiceError(f"AI request failed ({type(exc).__name__})") from exc

    if not content or not str(content).strip():
        raise AIServiceError("AI returned an empty reply")
    return str(content)
