"""
Turns a free-text problem into a validated, structured analysis.

The AI's reply is NEVER trusted as-is. Every field is parsed, type-
checked, clamped and (where it matters for safety) overridden by
deterministic backend rules:

  * category  -> must match a real Category row; otherwise fallback
  * urgency   -> must be one of four values; emergency keywords in the
                 user's own text force "emergency" regardless of what
                 the model said
  * tips      -> 2-4 short strings; for emergencies the first tip is
                 always the fixed "switch off the main power" tip
  * cost      -> sane non-negative min<=max range, else omitted
  * disclaimer-> fixed backend text, never model-generated
  * sources   -> only from our own Tavily results (Phase 4B), by number

Public entry point: analyze_problem(problem_text).
"""

import json
import logging
import re

from django.conf import settings

from categories.models import Category

from .llm_client import AIServiceError, request_completion
from .prompts import build_system_prompt, build_user_prompt, trim_history
from .web_search import find_references

logger = logging.getLogger(__name__)

URGENCY_LEVELS = ("low", "medium", "high", "emergency")
MAX_TIPS = 4
MIN_TIPS = 2
MAX_TIP_LENGTH = 220
MAX_SUMMARY_LENGTH = 400
MAX_COST_BDT = 1_000_000
MAX_SOURCES = 3
FALLBACK_SOURCES = 2

_BANGLA_RE = re.compile(r"[\u0980-\u09FF]")
_THINK_RE = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


class AnalysisError(AIServiceError):
    """The AI replied, but not with something we can safely use."""


# ── Emergency rule (deterministic, independent of the model) ────────
# English, Bangla script and romanised Bangla (Banglish) triggers.
_EMERGENCY_PATTERNS = [
    r"\bspark(s|ing|ed)?\b",
    r"\bburn(ing|t|ed)?\s+(smell|odou?r)\b",
    r"\bsmell(s|ing)?\s+(of\s+)?(burn(ing|t)?|smoke|plastic)\b",
    r"\bsmoke\b|\bsmoking\b",
    r"\b(exposed|bare|open|naked|loose|hanging)\s+(electric(al)?\s+)?(wire|wires|cable|cables)\b",
    r"\bwires?\s+(are\s+)?(exposed|bare|sparking)\b",
    r"\b(electric(al)?\s+)?shock(s|ed)?\b",
    r"\belectrocut\w*",
    r"\bshort[\s-]?circuit(ed)?\b",
    r"\b(on\s+fire|caught\s+fire|catching\s+fire|fire)\b",
    r"\b(melt(ed|ing)?|overheat(ed|ing)?)\b",
    # Banglish
    r"\b(pora|poda|puira|pura)\s*(gondho|gondh|ghrain)\b",
    r"\bgondho\s+(pachi|ashche|asche)\b",
    r"\bagun\b|\baagun\b",
    r"\b(khola|ulongo|ulanga)\s*(tar|taar)\b",
    r"\bdhoa\b|\bdhowa\b|\bdhuya\b",
    r"\bshock\s*(khaichi|khaisi|lagche|lagse|lagche)\b",
    r"\bspark\s*(hocche|hoche|hocche|hoy|korche)\b",
    # Bangla script
    r"স্পার্ক|স্পার্কিং|আগুন|ধোঁয়া|ধোয়া|ধুয়া",
    r"পোড়া\s*গন্ধ|পোড়া|পুড়ে|পুড়ছে|জ্বলছে",
    r"খোলা\s*তার|তার\s*খোলা|উন্মুক্ত\s*তার|ছেঁড়া\s*তার",
    r"শক\s*(খেয়ে|খেয়েছি|লেগেছে|লাগছে|লাগে|লাগল)|বিদ্যুৎস্পৃষ্ট|ইলেকট্রিক\s*শক|শর্ট\s*সার্কিট",
]
_EMERGENCY_RE = re.compile("|".join(f"(?:{p})" for p in _EMERGENCY_PATTERNS), re.IGNORECASE)

_POWER_OFF_TIP = {
    "en": (
        "Switch off the main power at the breaker/main switch first, and do "
        "not touch the affected wire, socket or appliance."
    ),
    "bn": (
        "আগে মেইন পাওয়ার সুইচ/ব্রেকার বন্ধ করুন এবং ক্ষতিগ্রস্ত তার, সকেট বা "
        "যন্ত্রটি ছোঁবেন না।"
    ),
}
# Used to drop duplicate "turn off main power" tips the model may add.
_POWER_TIP_HINT_RE = re.compile(
    r"main\s+(power|switch|breaker)|মেইন\s*(পাওয়ার|সুইচ|ব্রেকার)", re.IGNORECASE
)

_DISCLAIMER = {
    "en": (
        "This is only a rough estimate and general guidance, not professional "
        "advice. The provider's actual price may differ."
    ),
    "bn": (
        "এটি শুধু একটি মোটামুটি আন্দাজ ও সাধারণ নির্দেশনা, পেশাদার পরামর্শ নয়। "
        "প্রকৃত খরচ ভিন্ন হতে পারে।"
    ),
}


def detect_language(text, model_language=None):
    """
    Decided by the backend, not the model: Bangla script -> "bn",
    anything else (English or romanised Bangla) -> "en", matching the
    prompt's language rule. `model_language` is accepted for API
    symmetry but deliberately ignored -- fixed UI strings (power-off
    tip, disclaimer) must follow what the user actually wrote.
    """
    return "bn" if _BANGLA_RE.search(text or "") else "en"


def has_emergency_keywords(text):
    return bool(_EMERGENCY_RE.search(text or ""))


# ── Parsing ─────────────────────────────────────────────────────────
def parse_model_json(raw):
    """
    Extracts one JSON object from the model's reply. Tolerates the
    common ways models wrap JSON: <think> blocks (reasoning models
    such as Nemotron), ```json fences, and leading/trailing chatter.
    """
    if not isinstance(raw, str):
        raise AnalysisError("AI reply was not text")

    text = _THINK_RE.sub("", raw).strip()
    text = _FENCE_RE.sub("", text).strip()

    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise AnalysisError("AI reply contained no JSON object")
        try:
            data = json.loads(text[start : end + 1])
        except (ValueError, TypeError) as exc:
            raise AnalysisError("AI reply was not valid JSON") from exc

    if not isinstance(data, dict):
        raise AnalysisError("AI reply JSON was not an object")
    return data


def _clean_str(value, max_len):
    if not isinstance(value, str):
        return ""
    # Collapse whitespace; AI output is plain text only -- the
    # frontend must also render it as text, never HTML (Phase 5).
    value = re.sub(r"\s+", " ", value).strip()
    return value[:max_len].rstrip()


def _number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        digits = re.sub(r"[^\d.]", "", value.replace(",", ""))
        try:
            return float(digits) if digits else None
        except ValueError:
            return None
    return None


def _resolve_category(raw_name, categories):
    """
    Returns (category_or_None, used_fallback).
    Exact (case/whitespace-insensitive) match against the DB list; any
    other name -> the configured fallback category if it exists, else None.
    """
    wanted = _clean_str(raw_name, 100).casefold()
    for category in categories:
        if category.name.casefold() == wanted:
            return category, False

    fallback_name = (settings.AI_FALLBACK_CATEGORY or "").casefold()
    for category in categories:
        if category.name.casefold() == fallback_name:
            return category, True
    return None, True


def _clean_tips(raw_tips):
    if not isinstance(raw_tips, list):
        return []
    tips = []
    for tip in raw_tips:
        cleaned = _clean_str(tip, MAX_TIP_LENGTH)
        if cleaned and cleaned not in tips:
            tips.append(cleaned)
    return tips


def _clean_cost(data, language):
    low, high = _number(data.get("cost_min")), _number(data.get("cost_max"))
    if low is None or high is None:
        return None
    if low < 0 or high < 0 or low > high or high > MAX_COST_BDT:
        return None
    return {
        "min": int(round(low)),
        "max": int(round(high)),
        "currency": "BDT",
        "disclaimer": _DISCLAIMER[language],
    }


def _pick_sources(raw_ids, web_results):
    """
    Sources shown to the customer. They ALWAYS come from our own
    Tavily list (the model only supplies numbers): invalid, duplicate
    or out-of-range numbers and any model-written URLs are ignored. If
    the model cited nothing usable we show the top few as general
    references rather than hide the search.
    """
    if not web_results:
        return []
    chosen = []
    if isinstance(raw_ids, list):
        for item in raw_ids:
            if isinstance(item, bool):
                continue
            if isinstance(item, str) and item.strip().isdigit():
                item = int(item.strip())
            if isinstance(item, int) and 1 <= item <= len(web_results) and item not in chosen:
                chosen.append(item)
    picked = [web_results[i - 1] for i in chosen[:MAX_SOURCES]] or web_results[:FALLBACK_SOURCES]
    return [{"title": r["title"], "url": r["url"], "domain": r["domain"]} for r in picked]


def validate_analysis(data, problem_text, categories, web_results=(), context_text=""):
    """Raises AnalysisError if unusable; otherwise returns the final dict."""
    summary = _clean_str(data.get("summary"), MAX_SUMMARY_LENGTH)
    if not summary:
        raise AnalysisError("AI reply had no summary")

    tips = _clean_tips(data.get("safety_tips"))
    if len(tips) < MIN_TIPS:
        raise AnalysisError("AI reply had too few safety tips")
    tips = tips[:MAX_TIPS]

    language = detect_language(problem_text, data.get("language"))

    urgency = str(data.get("urgency", "")).strip().lower()
    if urgency not in URGENCY_LEVELS:
        urgency = "medium"

    # Emergency rule: backend keywords OR the model itself saying
    # emergency -> emergency, and the main-power-off tip comes first.
    # context_text = earlier turns of the conversation (Phase 4C): a
    # follow-up in an emergency conversation is still an emergency.
    if has_emergency_keywords(problem_text) or has_emergency_keywords(context_text):
        urgency = "emergency"
    if urgency == "emergency":
        tips = [t for t in tips if not _POWER_TIP_HINT_RE.search(t)]
        tips = [_POWER_OFF_TIP[language]] + tips
        tips = tips[:MAX_TIPS]

    category, used_fallback = _resolve_category(data.get("category"), categories)

    return {
        "category": {"id": category.id, "name": category.name} if category else None,
        "category_fallback": used_fallback,
        "urgency": urgency,
        "summary": summary,
        "safety_tips": tips,
        "cost_estimate": _clean_cost(data, language),
        "language": language,
        "sources": _pick_sources(data.get("sources"), list(web_results)),
    }


def analyze_problem(problem_text, history=None):
    """
    Full pipeline: build prompts -> call AI -> parse -> validate.

    history (Phase 4C, optional): earlier turns of this conversation,
    [{"problem", "summary"}, ...]. Only the last few are used, trimmed,
    so a follow-up like "can it be cheaper?" is understood in context
    without a big prompt. The server stores nothing: the client sends
    the history with each request.

    Retries only when the reply was *malformed* (up to
    AI_MALFORMED_RETRIES extra attempts); transport errors (timeout,
    network, auth) fail immediately, so a down provider never causes
    a pile of billed retries. Raises AIServiceError on failure.
    """
    categories = list(Category.objects.all())
    turns = trim_history(history)
    context_text = " ".join(t["problem"] for t in turns)

    # Phase 4B: live web references. Skipped for emergencies (speed
    # matters, and the fixed "switch off the main power" tip is what
    # counts) and silently empty when Tavily is off/failing.
    web_results = []
    if not (has_emergency_keywords(problem_text) or has_emergency_keywords(context_text)):
        # A follow-up like "can it be cheaper?" is a useless search on its
        # own, so it is searched together with the previous problem.
        search_text = f"{problem_text} {turns[-1]['problem']}" if turns else problem_text
        try:
            web_results = find_references(search_text)
        except Exception:
            logger.exception("Web reference lookup failed")
            web_results = []

    system_prompt = build_system_prompt(
        [c.name for c in categories], with_web=bool(web_results), with_history=bool(turns)
    )
    user_prompt = build_user_prompt(problem_text, web_results, turns)

    attempts = 1 + max(0, settings.AI_MALFORMED_RETRIES)
    last_error = None
    for attempt in range(1, attempts + 1):
        raw = request_completion(system_prompt, user_prompt)  # AIServiceError propagates
        try:
            data = parse_model_json(raw)
            return validate_analysis(data, problem_text, categories, web_results, context_text)
        except AnalysisError as exc:
            last_error = exc
            logger.warning("AI reply rejected (attempt %s/%s): %s", attempt, attempts, exc)

    raise last_error
