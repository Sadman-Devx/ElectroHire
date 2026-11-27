from rest_framework import serializers

from .models import WalletTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    """
    One ledger line for the provider's statement. Money fields come out as
    decimal strings ("-150.00"), like every other money field in the API.
    `direction` is "credit" (balance went up) or "debit" (went down).
    """

    entry_label = serializers.CharField(source="get_entry_type_display", read_only=True)
    direction = serializers.SerializerMethodField()
    booking_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "entry_type",
            "entry_label",
            "direction",
            "amount",
            "balance_after",
            "due_cleared",
            "booking_id",
            "reference",
            "note",
            "created_at",
        ]

    def get_direction(self, obj):
        return "credit" if obj.amount >= 0 else "debit"