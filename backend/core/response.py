"""
Shared response helpers used by every app's API views.

The API Contract standardizes every response to:

    Success -> {"status": "success", "message": "...", "data": {...}}
    Error   -> {"status": "error",   "message": "..."}

Building these in one place means every endpoint across every dev's
app looks identical to the frontend team, and Day 10's "Error Response
Consistent করো" task is already satisfied by construction.
"""

from rest_framework.response import Response


def success_response(message=None, data=None, status_code=200):
    payload = {"status": "success"}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return Response(payload, status=status_code)


def error_response(message, status_code=400, errors=None):
    payload = {"status": "error", "message": message}
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status_code)


def first_error_message(serializer_errors):
    """
    DRF serializer.errors looks like:
        {"email": ["Email already exists"], "password": ["This field is required."]}
    or occasionally:
        {"non_field_errors": ["..."]}

    The API contract wants a single flat "message" string, so pull out
    the first error message in a stable, deterministic order.
    """
    for field in sorted(serializer_errors.keys()):
        value = serializer_errors[field]
        if isinstance(value, (list, tuple)) and value:
            detail = str(value[0])
        else:
            detail = str(value)
        return detail
    return "Invalid data"