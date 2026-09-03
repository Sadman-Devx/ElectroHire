# Hand-written (no makemigrations access in this sandbox) — Dev 2, Day 11.
# Adds OTP.purpose so a code issued for signup verification and one
# issued for password reset can never be used to satisfy the other flow.
# Explicit index name (users_otp_email_purpose_idx), same convention
# reports/migrations/0001_initial.py already established, so this stays
# in sync with models.py without needing makemigrations to compute
# Django's usual hash-suffixed name.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_managers_remove_user_username_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='otp',
            name='purpose',
            field=models.CharField(
                choices=[('signup', 'Signup Verification'), ('password_reset', 'Password Reset')],
                default='signup',
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='otp',
            index=models.Index(
                fields=['email', 'purpose', 'is_used'],
                name='users_otp_email_purpose_idx',
            ),
        ),
    ]