"""
Wallet / ledger business rules. No HTTP code here -- the API views, the
Django admin and any future payment-gateway webhook all call these
functions, so there is exactly one definition of how money moves.

The four situations (see wallet/models.py for the data model)
-------------------------------------------------------------
1. CASH job completed   -> post_cash_commission()
       The provider kept all the cash, so the platform's commission is
       DEBITED from the wallet. If the wallet holds a positive balance
       (earlier online earnings) the commission is taken from it first;
       only what is left over becomes "due".
2. ONLINE job completed -> post_online_earning()
       The platform holds the customer's money. price - commission is
       CREDITED. If the provider has due, that credit clears it first
       (oldest job first) -- this is the "auto-settle from the next
       online payout" rule.
3. Due paid by hand     -> record_manual_payment()   (admin)
4. Due limit            -> is_provider_blocked() in bookings/commission.py
       due >= COMMISSION_BLOCK_THRESHOLD => cannot accept NEW bookings.

Concurrency
-----------
Every money-moving function runs inside transaction.atomic() and locks
the provider's wallet row (select_for_update) before reading the
balance, so two requests can never both act on a stale balance. Lock
order everywhere: booking row -> wallet row -> other booking rows.
Per-booking ledger lines are also protected by a partial unique
constraint, so a retried request cannot charge the same job twice.

Invariant (kept by every function below):
    wallet.balance == sum(ledger amounts)
    total unsettled commission on "due" bookings == max(-balance, 0)
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from bookings.commission import (
    COMMISSION_UPDATE_FIELDS,
    get_block_threshold,
    get_commission_rate,
    money_str,
)
from bookings.models import Booking

from .models import ProviderWallet, WalletTransaction

ZERO = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")

# Results of mark_booking_paid_online()
ONLINE_MARKED = "marked"  # confirmed job flagged online; credited on completion
ONLINE_CREDITED = "credited"  # completed job credited right now
ONLINE_SKIPPED = "skipped"  # not eligible (wrong status / already posted)

# Entry types an admin may add by hand through the Django admin form.
MANUAL_ENTRY_TYPES = (
    WalletTransaction.ENTRY_MANUAL_PAYMENT,
    WalletTransaction.ENTRY_WAIVER,
    WalletTransaction.ENTRY_PAYOUT,
)


class WalletError(Exception):
    """A wallet rule was broken (message is safe to show to staff)."""


def _q(value):
    return Decimal(value or 0).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


# ── Reads (never create rows, never lock) ───────────────────────────────


def get_balance(provider_id):
    """Signed balance: > 0 platform owes provider, < 0 provider owes platform."""
    value = (
        ProviderWallet.objects.filter(provider_id=provider_id)
        .values_list("balance", flat=True)
        .first()
    )
    return _q(value)


def get_due_amount(provider_id):
    """What the provider currently owes the platform (>= 0)."""
    return max(-get_balance(provider_id), ZERO)


def get_available_balance(provider_id):
    """What the platform currently owes the provider (>= 0)."""
    return max(get_balance(provider_id), ZERO)


def get_wallet_summary(provider):
    """Everything the provider's wallet screen needs, money as strings."""
    balance = get_balance(provider.pk)
    due = max(-balance, ZERO)
    available = max(balance, ZERO)
    threshold = get_block_threshold()
    is_blocked = threshold > 0 and due >= threshold

    totals = {
        row["entry_type"]: row
        for row in WalletTransaction.objects.filter(wallet__provider=provider)
        .values("entry_type")
        .annotate(total=Sum("amount"), cleared=Sum("due_cleared"))
    }

    def total(entry_type):
        return _q(totals.get(entry_type, {}).get("total"))

    def cleared(entry_type):
        return _q(totals.get(entry_type, {}).get("cleared"))

    return {
        "balance": money_str(balance),
        "available_balance": money_str(available),
        "due_amount": money_str(due),
        "rate_percent": money_str(get_commission_rate()),
        "block_threshold": money_str(threshold),
        "is_blocked": is_blocked,
        "remaining_before_block": money_str(
            max(threshold - due, ZERO) if threshold > 0 else ZERO
        ),
        # Lifetime totals (always positive numbers, for display).
        "total_cash_commission": money_str(-total(WalletTransaction.ENTRY_CASH_COMMISSION)),
        "total_online_earnings": money_str(total(WalletTransaction.ENTRY_ONLINE_EARNING)),
        "total_auto_settled": money_str(cleared(WalletTransaction.ENTRY_ONLINE_EARNING)),
        "total_paid_manually": money_str(total(WalletTransaction.ENTRY_MANUAL_PAYMENT)),
        "total_waived": money_str(total(WalletTransaction.ENTRY_WAIVER)),
        "total_paid_out": money_str(-total(WalletTransaction.ENTRY_PAYOUT)),
    }


# ── Internals (call only inside transaction.atomic) ─────────────────────


def _locked_wallet(provider_id):
    """Get-or-create the provider's wallet, then lock its row."""
    wallet, _created = ProviderWallet.objects.get_or_create(provider_id=provider_id)
    return ProviderWallet.objects.select_for_update().get(pk=wallet.pk)


def _record(wallet, entry_type, amount, *, booking=None, due_cleared=ZERO,
            reference="", note="", actor=None):
    """Append one ledger line and move the wallet balance by `amount`."""
    amount = _q(amount)
    wallet.balance = _q(wallet.balance + amount)
    wallet.save(update_fields=["balance", "updated_at"])
    return WalletTransaction.objects.create(
        wallet=wallet,
        booking=booking,
        entry_type=entry_type,
        amount=amount,
        balance_after=wallet.balance,
        due_cleared=_q(due_cleared),
        reference=(reference or "")[:100],
        note=(note or "")[:255],
        created_by=actor,
    )


def _settle_due_bookings(provider_id, amount, final_status):
    """
    Spend `amount` of credit on the provider's unpaid commissions, oldest
    job first. A booking whose commission is fully covered moves to
    `final_status` (paid / deducted / waived); a partly covered one stays
    "due" with a larger commission_settled_amount. Returns the amount
    actually applied (== `amount` unless the books were already out of
    step, which the callers never allow).
    """
    remaining = _q(amount)
    applied = ZERO
    now = timezone.now()

    due_bookings = (
        Booking.objects.select_for_update()
        .filter(provider_id=provider_id, commission_status=Booking.COMMISSION_DUE)
        .order_by("completed_at", "id")
    )
    for booking in due_bookings:
        if remaining <= 0:
            break
        owed = _q(booking.commission_amount - booking.commission_settled_amount)
        if owed <= 0:
            continue
        pay = min(owed, remaining)
        booking.commission_settled_amount = _q(booking.commission_settled_amount + pay)
        fields = ["commission_settled_amount", "updated_at"]
        if booking.commission_settled_amount >= booking.commission_amount:
            booking.commission_status = final_status
            fields.append("commission_status")
            if final_status == Booking.COMMISSION_PAID:
                booking.commission_paid_at = now
                fields.append("commission_paid_at")
        booking.save(update_fields=fields)
        remaining -= pay
        applied += pay
    return applied


# ── 1. Cash job ─────────────────────────────────────────────────────────


@transaction.atomic
def post_cash_commission(booking):
    """
    Cash job finished: debit the platform's commission from the wallet.

    Mutates `booking` (commission_settled_amount / commission_status) --
    the caller saves it with COMMISSION_UPDATE_FIELDS. Safe to call twice
    for the same booking: the second call finds the ledger line and does
    nothing.
    """
    commission = _q(booking.commission_amount)
    if commission <= 0:
        return None

    existing = WalletTransaction.objects.filter(
        booking=booking, entry_type=WalletTransaction.ENTRY_CASH_COMMISSION
    ).first()
    if existing is not None:
        return existing

    wallet = _locked_wallet(booking.provider_id)
    covered = min(commission, max(wallet.balance, ZERO))
    note = f"Cash job #{booking.pk}"
    if covered > 0:
        note += f" ({money_str(covered)} taken from your available balance)"

    entry = _record(
        wallet,
        WalletTransaction.ENTRY_CASH_COMMISSION,
        -commission,
        booking=booking,
        note=note,
    )
    booking.commission_settled_amount = covered
    booking.commission_status = (
        Booking.COMMISSION_DEDUCTED if covered >= commission else Booking.COMMISSION_DUE
    )
    return entry


# ── 2. Online job ───────────────────────────────────────────────────────


@transaction.atomic
def post_online_earning(booking):
    """
    Online job finished: the platform holds the money, so credit
    price - commission. Existing due is cleared first, automatically.

    Mutates `booking`; the caller saves it with COMMISSION_UPDATE_FIELDS.
    Idempotent per booking.
    """
    if booking.quoted_price is None:
        raise WalletError("This booking has no quoted price.")

    existing = WalletTransaction.objects.filter(
        booking=booking, entry_type=WalletTransaction.ENTRY_ONLINE_EARNING
    ).first()
    if existing is not None:
        return existing

    commission = _q(booking.commission_amount)
    net = _q(booking.quoted_price - commission)

    wallet = _locked_wallet(booking.provider_id)
    due_before = max(-wallet.balance, ZERO)
    to_clear = min(net, due_before)
    cleared = ZERO
    if to_clear > 0:
        cleared = _settle_due_bookings(
            booking.provider_id, to_clear, Booking.COMMISSION_DEDUCTED
        )

    note = f"Online job #{booking.pk}"
    if cleared > 0:
        note += f" ({money_str(cleared)} used to clear your due)"

    entry = _record(
        wallet,
        WalletTransaction.ENTRY_ONLINE_EARNING,
        net,
        booking=booking,
        due_cleared=cleared,
        note=note,
    )
    booking.payment_method = Booking.PAYMENT_ONLINE
    booking.commission_settled_amount = commission
    booking.commission_status = (
        Booking.COMMISSION_DEDUCTED if commission > 0 else Booking.COMMISSION_NONE
    )
    return entry


def post_completion_ledger(booking):
    """
    Called by the booking status view right after commission.apply_completion().
    Picks the right ledger movement for how this job was paid.
    """
    if booking.payment_method == Booking.PAYMENT_ONLINE and booking.quoted_price is not None:
        return post_online_earning(booking)
    if booking.commission_status == Booking.COMMISSION_DUE:
        return post_cash_commission(booking)
    return None  # no commission (zero rate / waived / never quoted)


@transaction.atomic
def mark_booking_paid_online(booking_id, actor=None):
    """
    The platform has received the customer's online payment for this
    booking (called by a payment-gateway webhook, or by an admin action
    until a gateway exists). Only the platform may say this -- a provider
    can never flag a job as "online" themselves.

        confirmed -> flagged online; credited when the provider completes
        completed -> credited immediately

    Returns ONLINE_MARKED / ONLINE_CREDITED / ONLINE_SKIPPED.
    """
    booking = Booking.objects.select_for_update().get(pk=booking_id)

    if (
        booking.status not in (Booking.STATUS_CONFIRMED, Booking.STATUS_COMPLETED)
        or booking.quoted_price is None
    ):
        return ONLINE_SKIPPED
    if WalletTransaction.objects.filter(
        booking=booking, entry_type__in=WalletTransaction.PER_BOOKING_ENTRIES
    ).exists():
        return ONLINE_SKIPPED  # already posted (cash or online)

    booking.payment_method = Booking.PAYMENT_ONLINE
    if booking.status == Booking.STATUS_COMPLETED:
        post_online_earning(booking)
        booking.save(update_fields=["updated_at", *COMMISSION_UPDATE_FIELDS])
        return ONLINE_CREDITED

    booking.save(update_fields=["payment_method", "updated_at"])
    return ONLINE_MARKED


# ── 3. Settling due by hand (admin) ─────────────────────────────────────


def _require_positive(amount):
    amount = _q(amount)
    if amount <= 0:
        raise WalletError("Amount must be greater than zero.")
    return amount


def _clear_due(provider_id, amount, entry_type, final_status, actor, reference, note):
    amount = _require_positive(amount)
    wallet = _locked_wallet(provider_id)
    due = max(-wallet.balance, ZERO)
    if amount > due:
        raise WalletError(
            f"Amount {money_str(amount)} is more than the provider's due ({money_str(due)})."
        )
    _settle_due_bookings(provider_id, amount, final_status)
    return _record(
        wallet,
        entry_type,
        amount,
        due_cleared=amount,
        reference=reference,
        note=note,
        actor=actor,
    )


@transaction.atomic
def record_manual_payment(provider_id, amount, actor=None, reference="", note=""):
    """The provider paid `amount` of their due by hand (bKash, bank, cash)."""
    return _clear_due(
        provider_id,
        amount,
        WalletTransaction.ENTRY_MANUAL_PAYMENT,
        Booking.COMMISSION_PAID,
        actor,
        reference,
        note,
    )


@transaction.atomic
def record_waiver(provider_id, amount, actor=None, reference="", note=""):
    """Admin forgives `amount` of the provider's due."""
    return _clear_due(
        provider_id,
        amount,
        WalletTransaction.ENTRY_WAIVER,
        Booking.COMMISSION_WAIVED,
        actor,
        reference,
        note,
    )


@transaction.atomic
def record_payout(provider_id, amount, actor=None, reference="", note=""):
    """The platform paid `amount` of the provider's positive balance out."""
    amount = _require_positive(amount)
    wallet = _locked_wallet(provider_id)
    available = max(wallet.balance, ZERO)
    if amount > available:
        raise WalletError(
            f"Amount {money_str(amount)} is more than the available balance ({money_str(available)})."
        )
    return _record(
        wallet,
        WalletTransaction.ENTRY_PAYOUT,
        -amount,
        reference=reference,
        note=note,
        actor=actor,
    )


def record_manual_entry(provider_id, entry_type, amount, actor=None, reference="", note=""):
    """Dispatcher used by the Django admin "add ledger entry" form."""
    handlers = {
        WalletTransaction.ENTRY_MANUAL_PAYMENT: record_manual_payment,
        WalletTransaction.ENTRY_WAIVER: record_waiver,
        WalletTransaction.ENTRY_PAYOUT: record_payout,
    }
    handler = handlers.get(entry_type)
    if handler is None:
        raise WalletError("This entry type cannot be added by hand.")
    return handler(provider_id, amount, actor=actor, reference=reference, note=note)


@transaction.atomic
def settle_booking_commission(booking_id, kind, actor=None, reference=""):
    """
    Admin action on ONE booking: mark its remaining commission as paid
    (kind="paid") or waived (kind="waived"). Posts the matching ledger
    line so the wallet stays in step. Returns True if something was
    settled, False if the booking had nothing due.
    """
    if kind not in ("paid", "waived"):
        raise WalletError("kind must be 'paid' or 'waived'.")

    booking = Booking.objects.select_for_update().get(pk=booking_id)
    if booking.commission_status != Booking.COMMISSION_DUE:
        return False
    remaining = _q(booking.commission_amount - booking.commission_settled_amount)
    if remaining <= 0:
        return False

    wallet = _locked_wallet(booking.provider_id)
    is_paid = kind == "paid"
    entry = _record(
        wallet,
        WalletTransaction.ENTRY_MANUAL_PAYMENT if is_paid else WalletTransaction.ENTRY_WAIVER,
        remaining,
        booking=booking,  # the unique constraint only covers cash/online lines
        due_cleared=remaining,
        reference=reference,
        note=f"{'Paid' if is_paid else 'Waived'}: job #{booking.pk}",
        actor=actor,
    )
    booking.commission_settled_amount = _q(booking.commission_amount)
    booking.commission_status = (
        Booking.COMMISSION_PAID if is_paid else Booking.COMMISSION_WAIVED
    )
    fields = ["commission_settled_amount", "commission_status", "updated_at"]
    if is_paid:
        booking.commission_paid_at = timezone.now()
        fields.append("commission_paid_at")
    if reference:
        booking.commission_reference = reference[:100]
        fields.append("commission_reference")
    booking.save(update_fields=fields)
    return entry is not None