"""
Custom DRF exception handler — Day 10, Dev 1 pre-existing bug fix.

core/response.py already standardizes every hand-written view's error
reply to {"status": "error", "message": "..."} (see that module's
docstring — "Day 10's 'Error Response Consistent করো' task is already
satisfied by construction"). That is true for every error a *view's
own code* returns via error_response().

It is NOT true for errors DRF's own machinery raises before a view's
code ever runs: an expired/invalid JWT
(rest_framework_simplejwt.authentication.JWTAuthentication), a missing
Authorization header, an unsupported HTTP method, DRF's own
NotFound/PermissionDenied, request throttling, and so on. All of those
bypass error_response() entirely and fall through to DRF's default
exception handler, which replies with a bare {"detail": "..."} — or,
for a SimpleJWT InvalidToken, {"detail": ..., "code": ...,
"messages": [...]}.

Found during the Day 10 pre-build/E2E audit while exercising the JWT
refresh flow end-to-end (built Day 9): hitting a protected endpoint
with an invalid/expired access token returns a *differently shaped*
error body than literally every other endpoint in the app. That's
the same "Error Response Consistent করো" problem the Day 10 schedule
already names, just one level up, at the framework boundary instead
of inside a view.

frontend/src/lib/apiError.js already defends against a missing
"message" key (falls back to a generic string — see toServiceError),
so nothing was silently crashing for the user, but a real, useful
message ("Given token not valid for any token type", "Authentication
credentials were not provided.", ...) was being thrown away in favor
of that generic fallback.

This handler delegates to DRF's default exception_handler first — so
status codes, WWW-Authenticate headers, Retry-After on throttling,
etc. are all untouched — then reshapes whatever body it produced into
the same {"status": "error", "message": "..."} contract every
hand-written view already uses. Exceptions DRF's default handler
doesn't recognize (i.e. it returns None — an unhandled Python
exception) are left completely alone, same as before this handler
existed, so Django's normal 500 handling is unaffected.
"""

from rest_framework.views import exception_handler as drf_exception_handler

from core.response import _first_leaf_message


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    data = response.data
    message = None

    if isinstance(data, dict):
        # SimpleJWT's InvalidToken puts the specific reason inside
        # "messages": [{"message": "...", ...}], with "detail" often
        # just a generic summary ("Given token not valid for any
        # token type") — prefer the specific one when it's present.
        messages = data.get("messages")
        if isinstance(messages, list) and messages:
            first = messages[0]
            if isinstance(first, dict) and first.get("message"):
                message = str(first["message"])

        if message is None and data.get("detail"):
            message = str(data["detail"])

        if message is None:
            # Plain serializer-style {"field": ["error", ...]} bodies
            # DRF can also produce outside our own views — fall back
            # to the same "first leaf message, deterministic order,
            # arbitrary nesting" rule core.response.first_error_message
            # uses (Day 10, Dev 2 fix — see that function's docstring
            # for the nested-ListField bug this also guards against
            # here, at the framework boundary).
            for key in sorted(data.keys(), key=str):
                leaf = _first_leaf_message(data[key])
                if leaf:
                    message = leaf
                    break
    elif isinstance(data, list) and data:
        message = str(data[0])

    if not message:
        message = "An error occurred."

    response.data = {"status": "error", "message": message}
    return response