# Hand-written. How much of this booking's commission has already been
# cleared (by auto-deduction from the wallet / online earnings, a manual
# payment, or a waiver). Existing rows start at 0.

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0002_booking_commission'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='commission_settled_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10),
        ),
    ]