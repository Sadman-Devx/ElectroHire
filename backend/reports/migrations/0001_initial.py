# Generated for Django 6.0.7 — Dev 2, Day 8

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Report',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reported_id', models.PositiveIntegerField(help_text='ID of the reported User or Provider, per reported_type.')),
                ('reported_type', models.CharField(choices=[('provider', 'Provider'), ('user', 'User')], max_length=20)),
                ('reason', models.CharField(choices=[('fake', 'Fake'), ('inappropriate', 'Inappropriate'), ('wrong_info', 'Wrong Info'), ('harassment', 'Harassment'), ('other', 'Other')], max_length=20)),
                ('details', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('resolved', 'Resolved'), ('dismissed', 'Dismissed')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reported_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reports_filed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['reported_type', 'reported_id'], name='reports_type_target_idx'),
                    models.Index(fields=['status'], name='reports_status_idx'),
                ],
            },
        ),
    ]