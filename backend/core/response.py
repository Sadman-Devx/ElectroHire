"""
Shared response helpers used by every app's API views.

The API Contract standardizes every response to:

    Success -> {"status": "success", "message": "...", "data": {...}}
    Error   -> {"status": "error",   "message": "..."}

Building these in one place means every endpoint across every dev's
app looks identical to the frontend team, and Day 10's "Error Response
Consistent" task is already satisfied by construction.
"""

from rest_framework.response import Response


def success_response(message=None, data=None, status_code=200, **extra_fields):
    payload = {"status": "success"}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    # e.g. success_response(data=..., count=24) for GET /api/providers/,
    # which needs a top-level "count" alongside "data" per the contract.
    payload.update(extra_fields)
    return Response(payload, status=status_code)


def error_response(message, status_code=400, errors=None):
    payload = {"status": "error", "message": message}
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def _first_leaf_message(value):
    """
    Descends into a DRF error structure (arbitrarily nested lists/dicts)
    and returns the first leaf error string it finds, or None if `value`
    contains no error text at all (e.g. an empty list/dict).

    A plain field just nests one level -- {"email": ["Email already
    exists"]} -- but a ListField(child=...) whose *child* fails
    validation nests one level deeper instead, keyed by the child's
    index: {"categories": {0: ["A valid integer is required."]}}. Only
    checking the first level (as this used to) falls through to
    `str(value)` for that dict-shaped case and returns Python's raw
    repr of the whole structure instead of the actual message.
    """
    if isinstance(value, dict):
        for key in sorted(value.keys(), key=str):
            leaf = _first_leaf_message(value[key])
            if leaf:
                return leaf
        return None
    if isinstance(value, (list, tuple)):
        for item in value:
            leaf = _first_leaf_message(item)
            if leaf:
                return leaf
        return None
    if value in (None, ""):
        return None
    return str(value)


def first_error_message(serializer_errors):
    """
    DRF serializer.errors looks like:
        {"email": ["Email already exists"], "password": ["This field is required."]}
    or occasionally:
        {"non_field_errors": ["..."]}
    or, for a ListField whose child fails validation, one level deeper
    still:
        {"categories": {0: ["A valid integer is required."]}}

    The API contract wants a single flat "message" string, so pull out
    the first leaf error message in a stable, deterministic order —
    recursing through whichever of the shapes above `serializer_errors`
    turns out to be (see _first_leaf_message).

    Day 10, Dev 2 bug fix: found during the Day 10 E2E provider-journey
    pass while sending an empty/malformed `categories` list to POST
    /api/providers/profile/ -- the previous one-level-only version
    returned the raw Python repr of the nested error dict as the
    top-level "message" instead of a clean sentence. Fixing it here
    (rather than in each view) fixes every caller at once, since every
    view already routes through this one helper.
    """
    for field in sorted(serializer_errors.keys()):
        message = _first_leaf_message(serializer_errors[field])
        if message:
            return message
    return "Invalid data"