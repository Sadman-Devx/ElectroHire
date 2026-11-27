# Data migration. Before the wallet existed, unpaid cash commission lived
# only on Booking rows (commission_status="due"). This writes one opening
# ledger line per such booking so the wallet balance starts out equal to
# what providers already owe -- nobody's due silently disappears or
# doubles when the wallet goes live.

from decimal import Decimal

from django.db import migrations


def backfill_dues(apps, schema_editor):
    Booking = apps.get_model('bookings', 'Booking')
    ProviderWallet = apps.get_model('wallet', 'ProviderWallet')
    WalletTransaction = apps.get_model('wallet', 'WalletTransaction')

    wallets = {}
    due_bookings = Booking.objects.filter(
        commission_status='due', commission_amount__gt=0
    ).order_by('completed_at', 'id')

    for booking in due_bookings.iterator():
        wallet = wallets.get(booking.provider_id)
        if wallet is None:
            wallet, _ = ProviderWallet.objects.get_or_create(provider_id=booking.provider_id)
            wallets[booking.provider_id] = wallet

        if WalletTransaction.objects.filter(
            booking_id=booking.pk, entry_type='cash_commission'
        ).exists():
            continue

        remaining = booking.commission_amount - booking.commission_settled_amount
        if remaining <= 0:
            continue

        wallet.balance = Decimal(wallet.balance) - Decimal(remaining)
        WalletTransaction.objects.create(
            wallet=wallet,
            booking_id=booking.pk,
            entry_type='cash_commission',
            amount=-Decimal(remaining),
            balance_after=wallet.balance,
            note='Opening balance (existing unpaid commission)',
        )

    for wallet in wallets.values():
        wallet.save(update_fields=['balance', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('wallet', '0001_initial'),
        ('bookings', '0003_booking_commission_settled_amount'),
    ]

    operations = [
        migrations.RunPython(backfill_dues, migrations.RunPython.noop),
    ]