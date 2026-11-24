# Hand-written (no makemigrations access in this sandbox), same convention
# as 0001_initial.py. Adds the provider-only commission columns.
# Existing rows get safe defaults: no quote, no commission, status "none".

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='quoted_price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='commission_rate',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='commission_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10),
        ),
        migrations.AddField(
            model_name='booking',
            name='commission_status',
            field=models.CharField(choices=[('none', 'No commission'), ('pending', 'Not yet due'), ('due', 'Due from provider'), ('paid', 'Paid by provider'), ('waived', 'Waived'), ('deducted', 'Deducted from online payment')], default='none', max_length=20),
        ),
        migrations.AddField(
            model_name='booking',
            name='payment_method',
            field=models.CharField(choices=[('cash', 'Cash to provider'), ('online', 'Online via platform')], default='cash', max_length=10),
        ),
        migrations.AddField(
            model_name='booking',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='commission_paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='commission_reference',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['provider', 'commission_status'], name='bookings_prov_comm_idx'),
        ),
    ]