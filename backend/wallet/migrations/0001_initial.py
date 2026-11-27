# Hand-written, same convention as bookings/migrations. Explicit index and
# constraint names so it matches models.py exactly.

from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('providers', '0001_initial'),
        ('bookings', '0003_booking_commission_settled_amount'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProviderWallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('balance', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provider', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='wallet', to='providers.provider')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='WalletTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[('cash_commission', 'Commission on cash job'), ('online_earning', 'Online job earning'), ('manual_payment', 'Due paid by provider'), ('waiver', 'Commission waived'), ('payout', 'Payout to provider')], max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('balance_after', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('due_cleared', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('reference', models.CharField(blank=True, default='', max_length=100)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('booking', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_entries', to='bookings.booking')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('wallet', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='transactions', to='wallet.providerwallet')),
            ],
            options={
                'ordering': ['-id'],
            },
        ),
        migrations.AddIndex(
            model_name='wallettransaction',
            index=models.Index(fields=['wallet', '-id'], name='wallet_tx_wallet_id_idx'),
        ),
        migrations.AddConstraint(
            model_name='wallettransaction',
            constraint=models.UniqueConstraint(condition=models.Q(('booking__isnull', False), ('entry_type__in', ['cash_commission', 'online_earning'])), fields=('booking', 'entry_type'), name='wallet_tx_booking_entry_uniq'),
        ),
    ]