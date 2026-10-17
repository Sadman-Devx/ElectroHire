"""
Phase 2: turn the (already validated) AI category into real providers.

Rules (guide.md, Phase 2):
  * Only providers with status="active" (admin-approved) are ever shown.
  * Ranking uses rating, review count and area. Rating is *damped*
    (Bayesian average) so one 5-star review can't beat 50 reviews at
    4.8: score = (n*avg + m*C) / (n + m).
  * If an area is known, only providers in that area are returned. If
    there are none, we say so politely and suggest alternatives (the
    same category in other areas, and other categories that DO have
    providers there).
  * The provider objects use the EXISTING ProviderListSerializer, so
    the shape is identical to GET /api/providers/ and can never leak
    more than that public endpoint already does: no phone, no email,
    no user id. Phone reveal stays in the existing contact flow.
  * If the AI could not name a real category (category is None or the
    fallback was used) we do NOT guess a provider type -- matching an
    electrician to a plumbing problem is worse than saying "pick one".

Public entry points: match_providers(...) and unavailable_result(...).
"""

import re

from django.db.models import Avg, Count

from categories.models import Category
from providers.models import Provider
from providers.serializers import ProviderListSerializer

MAX_MATCHES = 5
MAX_ALTERNATIVE_PROVIDERS = 3
MAX_ALTERNATIVE_CATEGORIES = 5
MAX_AREA_LENGTH = 100

# Bayesian damping: pretend every provider starts with PRIOR_WEIGHT
# reviews averaging PRIOR_MEAN. Unrated providers therefore score
# PRIOR_MEAN (below a well-reviewed good one, above a badly-rated one).
PRIOR_MEAN = 3.5
PRIOR_WEIGHT = 3

_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")

_MESSAGES = {
    "en": {
        "found_area": "Top-rated {category} providers in {area}.",
        "found_all": "Top-rated {category} providers.",
        "none_area": "There are no {category} providers in {area} right now.",
        "none_any": "There are no {category} providers available right now.",
        "unknown": (
            "We couldn't match your problem to a service category. "
            "You can pick one of the categories below."
        ),
        "unavailable": "Provider suggestions are unavailable right now.",
    },
    "bn": {
        "found_area": "{area} এলাকার সেরা রেটিংপ্রাপ্ত {category} প্রোভাইডার।",
        "found_all": "সেরা রেটিংপ্রাপ্ত {category} প্রোভাইডার।",
        "none_area": "{area} এলাকায় এখন কোনো {category} প্রোভাইডার নেই।",
        "none_any": "এখন কোনো {category} প্রোভাইডার পাওয়া যাচ্ছে না।",
        "unknown": (
            "আপনার সমস্যার জন্য সঠিক সার্ভিস ক্যাটাগরি খুঁজে পাইনি। "
            "নিচের ক্যাটাগরি থেকে বেছে নিতে পারেন।"
        ),
        "unavailable": "এই মুহূর্তে প্রোভাইডার সাজেশন পাওয়া যাচ্ছে না।",
    },
}


def clean_area(raw):
    """Normalise the optional user-supplied area; None if blank."""
    if not isinstance(raw, str):
        return None
    cleaned = re.sub(r"\s+", " ", _CONTROL_RE.sub(" ", raw)).strip()
    return cleaned[:MAX_AREA_LENGTH] or None


def rank_score(avg_rating, review_count):
    avg = avg_rating or 0.0
    count = review_count or 0
    return (count * avg + PRIOR_WEIGHT * PRIOR_MEAN) / (count + PRIOR_WEIGHT)


def _rank(providers):
    """Best first. Fully deterministic: score, reviews, experience, id."""
    return sorted(
        providers,
        key=lambda p: (
            -rank_score(p._avg_rating, p._review_count),
            -(p._review_count or 0),
            -(p.experience or 0),
            p.id,
        ),
    )


def _active_providers(category_id):
    # Filter on the category BEFORE annotating so the rating
    # aggregates are computed over exactly one category join row.
    return (
        Provider.objects.filter(status="active", categories__id=category_id)
        .select_related("user")
        .prefetch_related("categories")
        .annotate(
            _avg_rating=Avg("ratings__rating_value"),
            _review_count=Count("ratings", distinct=True),
        )
    )


def _serialize(providers, request):
    return list(
        ProviderListSerializer(providers, many=True, context={"request": request}).data
    )


def _categories_with_providers(exclude_id, area):
    """Other categories that currently have active providers."""
    categories = Category.objects.all()
    if exclude_id is not None:
        categories = categories.exclude(id=exclude_id)

    def counted(**provider_filters):
        return list(
            categories.filter(providers__status="active", **provider_filters)
            .annotate(provider_count=Count("providers", distinct=True))
            .order_by("-provider_count", "name")[:MAX_ALTERNATIVE_CATEGORIES]
        )

    found = counted(providers__area__icontains=area) if area else []
    if not found:
        found = counted()
    return [
        {"id": c.id, "name": c.name, "provider_count": c.provider_count} for c in found
    ]


def _empty(area, message):
    return {
        "area": area,
        "area_matched": None,
        "matches": [],
        "message": message,
        "alternatives": {"other_areas": [], "other_categories": []},
    }


def unavailable_result(language="en"):
    """Used if matching itself fails -- the AI analysis is still returned."""
    return _empty(None, _MESSAGES.get(language, _MESSAGES["en"])["unavailable"])


def match_providers(*, category, category_fallback, area, language, request):
    """
    category: {"id", "name"} from the validated analysis, or None.
    Returns the "providers" block that is added to the analyze response.
    """
    msgs = _MESSAGES.get(language, _MESSAGES["en"])
    area = clean_area(area)

    # The AI couldn't name a real category: don't guess a provider type.
    if category is None or category_fallback:
        result = _empty(area, msgs["unknown"])
        result["alternatives"]["other_categories"] = _categories_with_providers(None, area)
        return result

    name = category["name"]
    candidates = _active_providers(category["id"])

    if area:
        in_area = _rank(list(candidates.filter(area__icontains=area)))[:MAX_MATCHES]
        if in_area:
            result = _empty(area, msgs["found_area"].format(category=name, area=area))
            result["area_matched"] = True
            result["matches"] = _serialize(in_area, request)
            return result

        # Nobody in this area: be honest, then offer alternatives.
        elsewhere = _rank(list(candidates))[:MAX_ALTERNATIVE_PROVIDERS]
        key = "none_area" if elsewhere else "none_any"
        result = _empty(area, msgs[key].format(category=name, area=area))
        result["area_matched"] = False
        result["alternatives"]["other_areas"] = _serialize(elsewhere, request)
        result["alternatives"]["other_categories"] = _categories_with_providers(
            category["id"], area
        )
        return result

    top = _rank(list(candidates))[:MAX_MATCHES]
    if top:
        result = _empty(None, msgs["found_all"].format(category=name))
        result["matches"] = _serialize(top, request)
        return result

    result = _empty(None, msgs["none_any"].format(category=name))
    result["alternatives"]["other_categories"] = _categories_with_providers(
        category["id"], None
    )
    return result