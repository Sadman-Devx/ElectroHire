# Hand-written (no makemigrations access in this sandbox) — Dev 2, Day 11.
# Explicit index names, same convention reports/migrations/0001_initial.py
# already established, so this stays in sync with models.py without
# needing makemigrations to compute Django's usual hash-suffixed name.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('categories', '0001_initial'),
        ('providers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scheduled_date', models.DateField()),
                ('scheduled_time', models.TimeField()),
                ('address', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='categories.category')),
                ('provider', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='providers.provider')),
                ('user', models.ForeignKey(help_text='The customer who made this booking.', on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-scheduled_date', '-scheduled_time'],
            },
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['provider', 'status'], name='bookings_provider_status_idx'),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['user', 'status'], name='bookings_user_status_idx'),
        ),
    ]