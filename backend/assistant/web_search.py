"""
Phase 4B: live web references via Tavily Search.

Why: the AI's safety tips and cost range come from its training data,
which can be wrong or out of date. A real-time web search lets it use
(and cite) current sources.

Design rules:
  * OPTIONAL and FAIL-SOFT. No TAVILY_API_KEY, a timeout, no credits, a
    network error, bad JSON -> we return [] and the analysis carries on
    exactly as in Phase 1-3. Tavily can never break the assistant and
    never raises out of this module.
  * CHEAP. Always search_depth="basic" (1 credit), no auto_parameters,
    no include_answer. Identical queries are cached (default 24 h), so
    repeated demos/tests don't burn credits.
  * PRIVATE. Only the problem text goes out, with emails, phone numbers
    and links scrubbed first. Nothing about the account or providers.
  * SAFE. Web text is untrusted: it is length-limited, stripped of our
    prompt delimiters, and only URLs with http/https are kept (so a
    "javascript:" link can never reach the UI). The model never writes
    URLs -- sources shown to users always come from this module's list.

Public entry point: find_references(problem_text) -> list of
{"title", "url", "domain", "snippet"}.
"""

import hashlib
import json
import logging
import re
import urllib.request
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
QUERY_SUFFIX = "home repair safety tips cost Bangladesh"
MAX_QUERY_PROBLEM_CHARS = 200
MAX_TITLE_LENGTH = 120
MAX_SNIPPET_LENGTH = 300
MAX_URL_LENGTH = 500
MAX_RESPONSE_BYTES = 1_000_000

_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"\S+@\S+\.\S+")
# 8+ digits with optional separators (works for Bangla digits too).
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{6,}\d")
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


# ── settings (read lazily so tests can override them) ──────────────
def _api_key():
    return (getattr(settings, "TAVILY_API_KEY", "") or "").strip()


def _timeout():
    return float(getattr(settings, "TAVILY_TIMEOUT_SECONDS", 8))


def _max_results():
    return max(1, int(getattr(settings, "TAVILY_MAX_RESULTS", 5)))


def _cache_seconds():
    return int(getattr(settings, "TAVILY_CACHE_SECONDS", 86400))


def is_enabled():
    return bool(_api_key())


# ── query building ─────────────────────────────────────────────────
def build_query(problem_text):
    """Scrubbed, capped search query, or None if nothing useful is left."""
    text = _CONTROL_RE.sub(" ", problem_text or "")
    text = _URL_RE.sub(" ", text)
    text = _EMAIL_RE.sub(" ", text)
    text = _PHONE_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()[:MAX_QUERY_PROBLEM_CHARS].strip()
    if not text:
        return None
    return f"{text} {QUERY_SUFFIX}"


# ── result cleaning ────────────────────────────────────────────────
def _clean_text(value, max_len):
    if not isinstance(value, str):
        return ""
    cleaned = re.sub(r"\s+", " ", _CONTROL_RE.sub(" ", value)).strip()
    return cleaned[:max_len].rstrip()


def _parse_safe_url(value):
    """Return (url, domain) for a plain http(s) URL, else None."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > MAX_URL_LENGTH:
        return None
    try:
        parsed = urlparse(value)
        host = parsed.hostname
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not host or "@" in parsed.netloc:
        return None
    domain = host.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return value, domain


def clean_results(data):
    """Tavily response dict -> safe, deduplicated list (at most max_results)."""
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        return []
    results, seen = [], set()
    for item in data["results"]:
        if not isinstance(item, dict):
            continue
        parsed = _parse_safe_url(item.get("url"))
        if not parsed:
            continue
        url, domain = parsed
        if url in seen:
            continue
        seen.add(url)
        results.append(
            {
                "title": _clean_text(item.get("title"), MAX_TITLE_LENGTH) or domain,
                "url": url,
                "domain": domain,
                "snippet": _clean_text(item.get("content"), MAX_SNIPPET_LENGTH),
            }
        )
        if len(results) >= _max_results():
            break
    return results


# ── network (the only function that touches the internet) ──────────
def _post_search(query):
    """One basic Tavily search (1 credit). Raises on any failure."""
    body = json.dumps(
        {
            "query": query,
            "search_depth": "basic",
            "max_results": _max_results(),
            "include_answer": False,
            "include_raw_content": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TAVILY_SEARCH_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_api_key()}",
        },
    )
    with urllib.request.urlopen(request, timeout=_timeout()) as response:
        return json.loads(response.read(MAX_RESPONSE_BYTES).decode("utf-8"))


def _cache_key(query):
    normalised = re.sub(r"\s+", " ", query).strip().casefold()
    return "assistant:tavily:" + hashlib.sha256(normalised.encode("utf-8")).hexdigest()


def find_references(problem_text):
    """
    Web references for a problem, or [] (never raises). Costs 1 Tavily
    credit per UNCACHED call.
    """
    if not is_enabled():
        return []
    query = build_query(problem_text)
    if not query:
        return []

    key = _cache_key(query)
    try:
        cached = cache.get(key)
    except Exception:
        cached = None
    if cached is not None:
        return cached

    try:
        results = clean_results(_post_search(query))
    except Exception as exc:  # network, timeout, HTTP 4xx/5xx, bad JSON...
        # Type only: messages can echo request details.
        logger.warning("Tavily search failed: %s", type(exc).__name__)
        return []

    logger.info("Tavily search ok: %s result(s), 1 credit", len(results))
    if results:
        try:
            cache.set(key, results, _cache_seconds())
        except Exception:
            pass
    return results
