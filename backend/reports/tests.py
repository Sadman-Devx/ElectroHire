from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from providers.models import Provider

from .models import Report

User = get_user_model()


# ════════════════════════════════════════════════════════════════
# Dev 2, Day 10 — reports/tests.py was still an empty stub (just the
# `startapp` boilerplate) despite Report being a full API Contract
# endpoint (Section 6: POST /api/reports/) built back on Day 8, plus
# an admin action surface (dismiss/block). Found during the Day 10
# pre-build audit — same category of pre-existing gap as an
# unfinished migration or a missing INSTALLED_APPS entry, just for
# test coverage instead of code. Filling it in here rather than
# leaving Report as the one app in the project nothing verifies.
# ════════════════════════════════════════════════════════════════
class ReportCreateViewTests(APITestCase):
    """POST /api/reports/ — Dev 2, Day 8."""

    def setUp(self):
        self.url = reverse("reports:create")

        self.reporter = User.objects.create_user(
            email="mahmudul@example.com",
            password="strongpass123",
            name="Mahmudul Hasan",
            phone="01712340001",
            role=User.ROLE_USER,
            verified=True,
            is_active=True,
        )
        access_token = RefreshToken.for_user(self.reporter).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        self.provider_user = User.objects.create_user(
            email="karim@example.com",
            password="strongpass123",
            name="Karim Uddin",
            phone="01712340002",
            role=User.ROLE_PROVIDER,
            verified=True,
            is_active=True,
        )
        self.provider = Provider.objects.create(
            user=self.provider_user, area="Dhanmondi", experience=8, status="active"
        )

        self.other_user = User.objects.create_user(
            email="rahim@example.com",
            password="strongpass123",
            name="Rahim Mia",
            phone="01712340003",
            role=User.ROLE_USER,
            verified=True,
            is_active=True,
        )

    # -- success cases --------------------------------------------------

    def test_report_provider_success(self):
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "provider",
            "reason": "fake",
            "details": "This person is not real.",
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(
            response.data["message"],
            "Report submitted. We will review within 24-48 hours.",
        )
        # Contract's success response is message-only, no `data` block
        # (unlike e.g. RatingCreateView) — see views.py docstring.
        self.assertNotIn("data", response.data)

        report = Report.objects.get()
        self.assertEqual(report.reported_by, self.reporter)
        self.assertEqual(report.reported_id, self.provider.id)
        self.assertEqual(report.reported_type, Report.TYPE_PROVIDER)
        self.assertEqual(report.reason, "fake")
        self.assertEqual(report.status, Report.STATUS_PENDING)

    def test_report_user_success(self):
        response = self.client.post(self.url, {
            "reported_id": self.other_user.id,
            "reported_type": "user",
            "reason": "harassment",
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "success")
        report = Report.objects.get()
        self.assertEqual(report.reported_type, Report.TYPE_USER)
        self.assertEqual(report.reported_id, self.other_user.id)

    def test_details_is_optional_and_defaults_to_blank(self):
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "provider",
            "reason": "other",
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Report.objects.get().details, "")

    def test_all_documented_reasons_accepted(self):
        for reason in ["fake", "inappropriate", "wrong_info", "harassment", "other"]:
            Report.objects.all().delete()
            response = self.client.post(self.url, {
                "reported_id": self.provider.id,
                "reported_type": "provider",
                "reason": reason,
            })
            self.assertEqual(response.status_code, 201, msg=f"reason={reason}")

    # -- auth -------------------------------------------------------------

    def test_requires_auth(self):
        self.client.credentials()  # drop the Authorization header
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "provider",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["status"], "error")

    # -- validation ---------------------------------------------------------

    def test_missing_required_fields_rejected(self):
        response = self.client.post(self.url, {})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("reported_id", response.data["errors"])
        self.assertIn("reported_type", response.data["errors"])
        self.assertIn("reason", response.data["errors"])
        # message must be a clean, single sentence — not a dict/list repr.
        self.assertIsInstance(response.data["message"], str)
        self.assertNotIn("ErrorDetail", response.data["message"])

    def test_invalid_reported_type_rejected(self):
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "not_a_real_type",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")

    def test_invalid_reason_rejected(self):
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "provider",
            "reason": "not_a_real_reason",
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")

    def test_nonexistent_provider_id_rejected(self):
        response = self.client.post(self.url, {
            "reported_id": 999999,
            "reported_type": "provider",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("Provider not found", response.data["message"])

    def test_nonexistent_user_id_rejected(self):
        response = self.client.post(self.url, {
            "reported_id": 999999,
            "reported_type": "user",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("User not found", response.data["message"])

    def test_reported_id_checked_against_the_right_table(self):
        # A valid User id, but reported_type says "provider" -- reported_id
        # must resolve against Provider.id specifically, not just "any row
        # with this id in some table". self.other_user.id has no matching
        # Provider row, so this must fail even though the id itself exists.
        response = self.client.post(self.url, {
            "reported_id": self.other_user.id,
            "reported_type": "provider",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("Provider not found", response.data["message"])

    def test_report_does_not_require_prior_contact(self):
        # Unlike rating, reporting has no ContactLog-eligibility gate per
        # the App Build doc (report exists precisely to flag bad actors,
        # including ones a user never actually transacted with).
        response = self.client.post(self.url, {
            "reported_id": self.provider.id,
            "reported_type": "provider",
            "reason": "other",
        })
        self.assertEqual(response.status_code, 201)


class ReportAdminAsymmetricTests(APITestCase):
    """
    Django Admin — Report Management dismiss/block actions (Dev 2, Day 8).

    Bidirectional per the App Build doc's edge case ("Report Feature
    Bidirectional (User <-> Provider উভয়ই Report করতে পারবে)") — both a
    reported Provider and a reported User must be blockable through the
    same admin action.
    """

    def setUp(self):
        self.staff = User.objects.create_superuser(
            email="admin@electrohire.com", password="adminpass123", name="Admin"
        )
        self.client.force_login(self.staff)
        self.changelist_url = reverse("admin:reports_report_changelist")

        self.reporter = User.objects.create_user(
            email="mahmudul@example.com", password="strongpass123", name="Mahmudul",
            role=User.ROLE_USER, is_active=True,
        )
        self.provider_user = User.objects.create_user(
            email="karim@example.com", password="strongpass123", name="Karim",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        self.provider = Provider.objects.create(
            user=self.provider_user, area="Dhanmondi", experience=8, status="active"
        )
        self.reported_user = User.objects.create_user(
            email="rahim@example.com", password="strongpass123", name="Rahim",
            role=User.ROLE_USER, is_active=True,
        )

    def test_dismiss_action_sets_status_dismissed(self):
        report = Report.objects.create(
            reported_by=self.reporter, reported_id=self.provider.id,
            reported_type=Report.TYPE_PROVIDER, reason="other",
        )
        response = self.client.post(self.changelist_url, {
            "action": "dismiss_reports",
            "_selected_action": [str(report.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, Report.STATUS_DISMISSED)

    def test_block_action_on_reported_provider_sets_rejected(self):
        report = Report.objects.create(
            reported_by=self.reporter, reported_id=self.provider.id,
            reported_type=Report.TYPE_PROVIDER, reason="fake",
        )
        response = self.client.post(self.changelist_url, {
            "action": "block_reported_entity",
            "_selected_action": [str(report.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.provider.refresh_from_db()
        report.refresh_from_db()
        self.assertEqual(self.provider.status, "rejected")
        self.assertEqual(report.status, Report.STATUS_RESOLVED)

    def test_block_action_on_reported_user_deactivates_account(self):
        report = Report.objects.create(
            reported_by=self.reporter, reported_id=self.reported_user.id,
            reported_type=Report.TYPE_USER, reason="harassment",
        )
        response = self.client.post(self.changelist_url, {
            "action": "block_reported_entity",
            "_selected_action": [str(report.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.reported_user.refresh_from_db()
        report.refresh_from_db()
        self.assertFalse(self.reported_user.is_active)
        self.assertEqual(report.status, Report.STATUS_RESOLVED)

    def test_block_action_is_bulk_across_mixed_types(self):
        provider_report = Report.objects.create(
            reported_by=self.reporter, reported_id=self.provider.id,
            reported_type=Report.TYPE_PROVIDER, reason="fake",
        )
        user_report = Report.objects.create(
            reported_by=self.reporter, reported_id=self.reported_user.id,
            reported_type=Report.TYPE_USER, reason="harassment",
        )
        response = self.client.post(self.changelist_url, {
            "action": "block_reported_entity",
            "_selected_action": [str(provider_report.id), str(user_report.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.provider.refresh_from_db()
        self.reported_user.refresh_from_db()
        self.assertEqual(self.provider.status, "rejected")
        self.assertFalse(self.reported_user.is_active)

    def test_status_filter_present_on_changelist(self):
        pending = Report.objects.create(
            reported_by=self.reporter, reported_id=self.provider.id,
            reported_type=Report.TYPE_PROVIDER, reason="other",
        )
        dismissed = Report.objects.create(
            reported_by=self.reporter, reported_id=self.provider.id,
            reported_type=Report.TYPE_PROVIDER, reason="other",
            status=Report.STATUS_DISMISSED,
        )
        response = self.client.get(self.changelist_url, {"status__exact": "pending"})
        self.assertEqual(response.status_code, 200)
        ids = {r.id for r in response.context["cl"].queryset}
        self.assertEqual(ids, {pending.id})
        self.assertNotIn(dismissed.id, ids)

    def test_anonymous_redirected_to_login(self):
        self.client.logout()
        response = self.client.get(self.changelist_url)
        self.assertEqual(response.status_code, 302)