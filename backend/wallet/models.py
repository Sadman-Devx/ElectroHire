"""
Provider wallet + commission ledger.

The idea in one paragraph
-------------------------
Every provider has ONE wallet with ONE signed balance:

    balance > 0   the platform owes the provider (online earnings not yet
                  paid out)                      -> "available balance"
    balance < 0   the provider owes the platform (commission from cash
                  jobs the provider has not yet paid) -> "due"

Nothing edits the balance directly. Every change is an append-only
WalletTransaction (a ledger line) that records the signed amount and the
balance right after it, so the balance can always be re-derived by adding
up the lines. Lines are never updated or deleted -- a mistake is fixed by
adding a new, opposite line.

Ledger line types (entry_type):
    cash_commission  (-)  cash job finished: provider kept all the cash,
                          so the platform's commission is debited.
    online_earning   (+)  online job finished: platform holds the money;
                          price - commission is credited. If the wallet
                          was in due, the credit automatically clears it
                          first (see `due_cleared`).
    manual_payment   (+)  provider paid their due by hand (bKash, bank,
                          hand-delivered ...); recorded by admin.
    waiver           (+)  admin forgives part of the due.
    payout           (-)  platform pays the provider's positive balance out.

All the rules live in wallet/services.py; this module is data only.
"""

from decimal import Decimal

from django.conf import settings
from django.db import models

from providers.models import Provider


class ProviderWallet(models.Model):
    provider = models.OneToOneField(
        Provider, on_delete=models.CASCADE, related_name="wallet"
    )
    # Signed: positive = platform owes provider, negative = provider owes
    # platform. A cached sum of the ledger, only ever changed by
    # wallet.services under a row lock.
    balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Wallet<{self.provider_id}> {self.balance}"

    @property
    def due_amount(self):
        return max(-self.balance, Decimal("0.00"))

    @property
    def available_balance(self):
        return max(self.balance, Decimal("0.00"))


class WalletTransaction(models.Model):
    ENTRY_CASH_COMMISSION = "cash_commission"
    ENTRY_ONLINE_EARNING = "online_earning"
    ENTRY_MANUAL_PAYMENT = "manual_payment"
    ENTRY_WAIVER = "waiver"
    ENTRY_PAYOUT = "payout"
    ENTRY_CHOICES = (
        (ENTRY_CASH_COMMISSION, "Commission on cash job"),
        (ENTRY_ONLINE_EARNING, "Online job earning"),
        (ENTRY_MANUAL_PAYMENT, "Due paid by provider"),
        (ENTRY_WAIVER, "Commission waived"),
        (ENTRY_PAYOUT, "Payout to provider"),
    )

    # Entry types tied to exactly one booking, at most once -- enforced by
    # the partial unique constraint below, so a retry or double click can
    # never charge the same job twice.
    PER_BOOKING_ENTRIES = (ENTRY_CASH_COMMISSION, ENTRY_ONLINE_EARNING)

    wallet = models.ForeignKey(
        ProviderWallet, on_delete=models.PROTECT, related_name="transactions"
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_entries",
    )
    entry_type = models.CharField(max_length=20, choices=ENTRY_CHOICES)
    # Signed: + increases the provider's balance, - decreases it.
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    # For credits: how much of `amount` went to clearing existing due
    # (e.g. an online job auto-settling an old cash commission).
    due_cleared = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    reference = models.CharField(max_length=100, blank=True, default="")
    note = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["wallet", "-id"], name="wallet_tx_wallet_id_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["booking", "entry_type"],
                condition=models.Q(
                    booking__isnull=False,
                    entry_type__in=["cash_commission", "online_earning"],
                ),
                name="wallet_tx_booking_entry_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.get_entry_type_display()} {self.amount} (wallet {self.wallet_id})"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Ledger entries are append-only and cannot be edited.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Ledger entries are append-only and cannot be deleted.")