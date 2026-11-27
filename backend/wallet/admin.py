from decimal import Decimal

from django import forms
from django.contrib import admin, messages
from django.db.models import Sum

from providers.models import Provider

from . import services
from .models import ProviderWallet, WalletTransaction

_LEDGER_FIELDS = (
    "wallet",
    "booking",
    "entry_type",
    "amount",
    "balance_after",
    "due_cleared",
    "reference",
    "note",
    "created_by",
    "created_at",
)


class WalletTransactionInline(admin.TabularInline):
    """Read-only ledger statement shown inside a wallet."""

    model = WalletTransaction
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ("created_at", "entry_type", "amount", "balance_after", "due_cleared", "booking", "reference", "note")
    readonly_fields = fields
    ordering = ("-id",)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ProviderWallet)
class ProviderWalletAdmin(admin.ModelAdmin):
    list_display = ("provider", "balance", "due", "available", "updated_at")
    search_fields = ("provider__user__name", "provider__user__email")
    list_filter = ()
    ordering = ("balance",)  # biggest debtors first
    readonly_fields = ("provider", "balance", "due", "available", "created_at", "updated_at")
    fields = readonly_fields
    inlines = [WalletTransactionInline]

    @admin.display(description="Due (owed to platform)")
    def due(self, obj):
        return f"{obj.due_amount:.2f}"

    @admin.display(description="Available (owed to provider)")
    def available(self, obj):
        return f"{obj.available_balance:.2f}"

    def has_add_permission(self, request):
        return False  # wallets are created automatically by wallet.services

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # balances only move through the ledger

    def changelist_view(self, request, extra_context=None):
        if request.method == "GET":
            due = -(
                ProviderWallet.objects.filter(balance__lt=0).aggregate(t=Sum("balance"))["t"]
                or Decimal("0.00")
            )
            owed = (
                ProviderWallet.objects.filter(balance__gt=0).aggregate(t=Sum("balance"))["t"]
                or Decimal("0.00")
            )
            self.message_user(
                request,
                f"Providers owe the platform {due:.2f} - the platform holds {owed:.2f} for providers.",
                level=messages.INFO,
            )
        return super().changelist_view(request, extra_context)


class ManualEntryForm(forms.ModelForm):
    """
    "Add ledger entry" form. Staff pick a provider and one of the three
    hand-recorded entry types; the numbers are validated against the
    provider's wallet before anything is written.
    """

    provider = forms.ModelChoiceField(
        queryset=Provider.objects.select_related("user").order_by("user__name"),
    )
    entry_type = forms.ChoiceField(
        choices=[
            (value, label)
            for value, label in WalletTransaction.ENTRY_CHOICES
            if value in services.MANUAL_ENTRY_TYPES
        ],
        help_text=(
            "Due paid by provider: they paid you (bKash/bank/cash). "
            "Commission waived: forgive part of their due. "
            "Payout to provider: you paid out their available balance."
        ),
    )
    amount = forms.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        help_text="Always a positive number; the direction is decided by the entry type.",
    )

    class Meta:
        model = WalletTransaction
        fields = ("provider", "entry_type", "amount", "reference", "note")

    def clean(self):
        cleaned = super().clean()
        provider = cleaned.get("provider")
        entry_type = cleaned.get("entry_type")
        amount = cleaned.get("amount")
        if not (provider and entry_type and amount):
            return cleaned

        if entry_type == WalletTransaction.ENTRY_PAYOUT:
            available = services.get_available_balance(provider.pk)
            if amount > available:
                raise forms.ValidationError(
                    f"Payout {amount:.2f} is more than the available balance ({available:.2f})."
                )
        else:
            due = services.get_due_amount(provider.pk)
            if amount > due:
                raise forms.ValidationError(
                    f"Amount {amount:.2f} is more than the provider's due ({due:.2f})."
                )
        return cleaned


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "wallet", "entry_type", "amount", "balance_after", "due_cleared", "booking", "reference")
    list_filter = ("entry_type",)
    search_fields = ("wallet__provider__user__name", "wallet__provider__user__email", "reference", "note")
    date_hierarchy = "created_at"
    list_select_related = ("wallet__provider__user", "booking")

    # Append-only: staff can add the three manual entry types, and look
    # at any line, but never edit or delete one. A mistake is corrected
    # with a new opposite entry.
    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = ManualEntryForm
        return super().get_form(request, obj, **kwargs)

    def get_fields(self, request, obj=None):
        if obj is None:
            return ("provider", "entry_type", "amount", "reference", "note")
        return _LEDGER_FIELDS

    def get_readonly_fields(self, request, obj=None):
        return _LEDGER_FIELDS if obj is not None else ()

    def save_model(self, request, obj, form, change):
        data = form.cleaned_data
        # The services re-check everything under a row lock; a WalletError
        # here would only happen if two staff members raced each other.
        entry = services.record_manual_entry(
            data["provider"].pk,
            data["entry_type"],
            data["amount"],
            actor=request.user,
            reference=data.get("reference", ""),
            note=data.get("note", ""),
        )
        # Make the admin's in-memory object mirror the saved ledger line
        # (the service created the real row) so its success redirect works.
        obj.pk = entry.pk
        obj.wallet_id = entry.wallet_id
        obj.amount = entry.amount
        obj.balance_after = entry.balance_after
        obj.due_cleared = entry.due_cleared
        obj.created_by = request.user
        obj.created_at = entry.created_at
        obj._state.adding = False