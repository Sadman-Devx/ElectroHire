"""
Provider-only commission rules for bookings.

The model in one paragraph
--------------------------
The customer sees ONE clean price: the provider's quote *is* the total
(no fee is added on top). The platform's commission is taken out of the
provider's side only:

    customer pays      = quoted_price
    platform commission = quoted_price x commission_rate
    provider keeps      = quoted_price - commission

Cash jobs: the provider is paid the whole amount by the customer, so the
platform cannot "cut" its share. Instead the commission becomes a
RECEIVABLE from the provider (Booking.commission_status = "due") that
admin marks as paid once the provider settles it. If a provider's unpaid
dues reach COMMISSION_BLOCK_THRESHOLD, they cannot accept NEW bookings
until they clear them (see BookingStatusUpdateView).

Settings (read from Django settings first, then the environment, then
the defaults below -- so nothing has to change in settings.py):
    COMMISSION_RATE_PERCENT      default 10    (0 - 100)
    COMMISSION_BLOCK_THRESHOLD   default 1000  (0 disables blocking)

This module has no HTTP code, only money rules, so the views, the admin
and any future payment-gateway code all share exactly one definition.
"""

import os
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.utils import timezone

from .models import Booking

MONEY_QUANT = Decimal("0.01")
DEFAULT_RATE_PERCENT = Decimal("10")
DEFAULT_BLOCK_THRESHOLD = Decimal("1000")

# Every column a commission transition may touch -- the views pass this
# (plus "status"/"updated_at") to save(update_fields=...).
COMMISSION_UPDATE_FIELDS = [
    "quoted_price",
    "commission_rate",
    "commission_amount",
    "commission_status",
    "commission_settled_amount",
    "payment_method",
    "completed_at",
]


def _read_decimal(name, default):
    raw = getattr(settings, name, None)
    if raw in (None, ""):
        raw = os.environ.get(name)
    if raw in (None, ""):
        return default
    try:
        value = Decimal(str(raw).strip())
    except (InvalidOperation, ValueError):
        return default
    return value if value >= 0 else default


def get_commission_rate():
    """Commission percentage as a Decimal in [0, 100], 2 decimal places."""
    rate = _read_decimal("COMMISSION_RATE_PERCENT", DEFAULT_RATE_PERCENT)
    if rate > 100:
        rate = DEFAULT_RATE_PERCENT
    return rate.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def get_block_threshold():
    """Unpaid-commission amount at which a provider is blocked (0 = never)."""
    return _read_decimal("COMMISSION_BLOCK_THRESHOLD", DEFAULT_BLOCK_THRESHOLD).quantize(
        MONEY_QUANT, rounding=ROUND_HALF_UP
    )


def calculate_commission(price, rate_percent):
    """Returns (commission, provider_net) for a price, both 2dp Decimals."""
    price = Decimal(price)
    commission = (price * Decimal(rate_percent) / Decimal("100")).quantize(
        MONEY_QUANT, rounding=ROUND_HALF_UP
    )
    return commission, (price - commission).quantize(MONEY_QUANT)


def money_str(value):
    """'1500.00' -- the one string format every money field uses in the API."""
    return f"{Decimal(value or 0).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP):.2f}"


def outstanding_for_provider(provider):
    """
    Total commission this provider currently owes the platform: the
    negative part of their wallet balance (wallet/services.py). The
    wallet is the single source of truth, so cash dues, online
    auto-deductions and manual payments all count correctly.
    """
    from wallet.services import get_due_amount  # lazy: wallet imports this module

    return get_due_amount(provider.pk)


def is_provider_blocked(provider):
    """True when unpaid commission has reached the block threshold."""
    threshold = get_block_threshold()
    if threshold <= 0:
        return False
    return outstanding_for_provider(provider) >= threshold


# ── State transitions (mutate the instance; the caller saves it) ─────────


def apply_quote(booking, quoted_price):
    """Provider confirms the job at `quoted_price`: lock price + rate."""
    rate = get_commission_rate()
    commission, _net = calculate_commission(quoted_price, rate)
    booking.quoted_price = Decimal(quoted_price).quantize(MONEY_QUANT)
    booking.commission_rate = rate
    booking.commission_amount = commission
    booking.commission_status = Booking.COMMISSION_PENDING


def apply_completion(booking):
    """
    Job finished. Cash is the only method a provider can report, so the
    commission becomes a receivable (wallet.services.post_cash_commission
    then debits it). "online" can only be set by the platform
    (wallet.services.mark_booking_paid_online) -- never a provider's own
    claim.
    """
    booking.completed_at = timezone.now()

    # A job the platform already flagged as paid online (gateway/admin,
    # never the provider) keeps that method; wallet.services finalises
    # its commission status when it credits the earning.
    if booking.payment_method == Booking.PAYMENT_ONLINE:
        return

    booking.payment_method = Booking.PAYMENT_CASH
    if booking.commission_status == Booking.COMMISSION_WAIVED:
        return  # admin forgave this commission before the job finished
    if booking.quoted_price is None or booking.commission_amount <= 0:
        booking.commission_status = Booking.COMMISSION_NONE
    else:
        booking.commission_status = Booking.COMMISSION_DUE


def void_commission(booking):
    """Cancelled/rejected: nothing was earned, so no commission exists."""
    booking.commission_amount = Decimal("0.00")
    booking.commission_rate = None
    booking.commission_settled_amount = Decimal("0.00")
    booking.commission_status = Booking.COMMISSION_NONE