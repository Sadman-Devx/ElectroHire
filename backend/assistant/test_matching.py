"""
Automated tests for Hackathon Phase 2 (provider matching).

Run with:  python manage.py test assistant

The AI is mocked exactly like in tests.py; the provider data is real
(test database), so ranking/filtering is exercised for real.
"""

import itertools
import json
from unittest.mock import patch

from django.test import SimpleTestCase

from providers.models import Provider, ProviderCategory
from ratings.models import Rating
from users.models import User

from . import matching
from .tests import MOCK_TARGET, AssistantTestBase, ai_reply

_counter = itertools.count(1)

PUBLIC_PROVIDER_KEYS = {
    "id", "name", "area", "experience", "photo",
    "categories", "avg_rating", "review_count", "status",
}


class MatchingTestBase(AssistantTestBase):
    def make_provider(self, name, category, area="Gulshan", status="active",
                      experience=3, phone=None, extra_categories=()):
        n = next(_counter)
        user = User.objects.create_user(
            email=f"prov{n}@email.com", password="strongpassword123", name=name,
            phone=phone or f"0181{n:07d}", role="provider", is_active=True, verified=True,
        )
        provider = Provider.objects.create(
            user=user, area=area, experience=experience, status=status
        )
        for cat in (category, *extra_categories):
            ProviderCategory.objects.create(provider=provider, category=cat)
        return provider

    def rate(self, provider, values):
        for value in values:
            n = next(_counter)
            rater = User.objects.create_user(
                email=f"rater{n}@email.com", password="strongpassword123",
                name=f"Rater {n}", phone=f"0191{n:07d}", role="user",
                is_active=True, verified=True,
            )
            Rating.objects.create(user=rater, provider=provider, rating_value=value)

    def analyze(self, problem="Ceiling fan ghure na", area=None, **ai):
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply(**ai)
            payload = {"problem": problem}
            if area is not None:
                payload["area"] = area
            response = self.client.post(self.url, payload, format="json", **self.auth)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["data"]["providers"]

    @staticmethod
    def names(block):
        return [p["name"] for p in block["matches"]]


# ════════════════════════════════════════════════════════════════
# Active-only + category filter
# ════════════════════════════════════════════════════════════════
class ActiveOnlyTests(MatchingTestBase):
    def test_only_active_providers_are_returned(self):
        self.make_provider("Active Ali", self.electrician, status="active")
        self.make_provider("Pending Pia", self.electrician, status="pending")
        self.make_provider("Rejected Raj", self.electrician, status="rejected")

        block = self.analyze()
        self.assertEqual(self.names(block), ["Active Ali"])
        self.assertTrue(all(p["status"] == "active" for p in block["matches"]))

    def test_inactive_providers_never_appear_in_alternatives_either(self):
        self.make_provider("Pending Pia", self.electrician, area="Banani", status="pending")
        block = self.analyze(area="Gulshan")
        self.assertEqual(block["alternatives"]["other_areas"], [])

    def test_only_providers_of_the_ai_category_are_returned(self):
        self.make_provider("Elec Eve", self.electrician)
        self.make_provider("Plumb Pat", self.plumber)
        block = self.analyze(category="Electrician")
        self.assertEqual(self.names(block), ["Elec Eve"])

    def test_provider_with_two_categories_appears_once(self):
        self.make_provider("Both Bea", self.electrician, extra_categories=[self.plumber])
        block = self.analyze()
        self.assertEqual(self.names(block), ["Both Bea"])


# ════════════════════════════════════════════════════════════════
# Area handling
# ════════════════════════════════════════════════════════════════
class AreaTests(MatchingTestBase):
    def test_area_filters_case_insensitively_and_partially(self):
        self.make_provider("Gulshan Gus", self.electrician, area="Gulshan 2, Dhaka")
        self.make_provider("Banani Ben", self.electrician, area="Banani")
        block = self.analyze(area="gulshan")
        self.assertEqual(self.names(block), ["Gulshan Gus"])
        self.assertTrue(block["area_matched"])
        self.assertEqual(block["area"], "gulshan")

    def test_no_area_returns_providers_from_everywhere(self):
        self.make_provider("A", self.electrician, area="Gulshan")
        self.make_provider("B", self.electrician, area="Banani")
        block = self.analyze()
        self.assertEqual(set(self.names(block)), {"A", "B"})
        self.assertIsNone(block["area_matched"])
        self.assertIsNone(block["area"])

    def test_blank_or_whitespace_area_is_treated_as_no_area(self):
        self.make_provider("A", self.electrician, area="Gulshan")
        for blank in ("", "   "):
            with self.subTest(area=blank):
                block = self.analyze(area=blank)
                self.assertIsNone(block["area"])
                self.assertEqual(self.names(block), ["A"])

    def test_null_area_is_accepted(self):
        self.make_provider("A", self.electrician)
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply()
            response = self.client.post(
                self.url, {"problem": "Ceiling fan ghure na", "area": None},
                format="json", **self.auth,
            )
        self.assertEqual(response.status_code, 200)

    def test_area_is_never_sent_to_the_ai(self):
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply()
            self.client.post(
                self.url, {"problem": "Ceiling fan ghure na", "area": "Mirpur DOHS"},
                format="json", **self.auth,
            )
        self.assertNotIn("Mirpur", " ".join(mock_ai.call_args.args))


# ════════════════════════════════════════════════════════════════
# No-provider fallbacks
# ════════════════════════════════════════════════════════════════
class FallbackTests(MatchingTestBase):
    def test_no_provider_in_area_suggests_other_areas_and_categories(self):
        self.make_provider("Banani Ben", self.electrician, area="Banani")
        self.make_provider("Gulshan Plumb", self.plumber, area="Gulshan")

        block = self.analyze(area="Gulshan")

        self.assertEqual(block["matches"], [])
        self.assertFalse(block["area_matched"])
        self.assertIn("no Electrician providers in Gulshan", block["message"])
        self.assertEqual(
            [p["name"] for p in block["alternatives"]["other_areas"]], ["Banani Ben"]
        )
        cats = block["alternatives"]["other_categories"]
        self.assertEqual([c["name"] for c in cats], ["Plumber"])
        self.assertEqual(cats[0]["provider_count"], 1)

    def test_no_provider_for_category_anywhere_is_a_polite_message(self):
        self.make_provider("Plumb Pat", self.plumber)
        block = self.analyze()  # AI says Electrician, none exist
        self.assertEqual(block["matches"], [])
        self.assertIn("no Electrician providers available", block["message"])
        self.assertEqual([c["name"] for c in block["alternatives"]["other_categories"]], ["Plumber"])

    def test_no_providers_at_all_does_not_crash(self):
        block = self.analyze(area="Gulshan")
        self.assertEqual(block["matches"], [])
        self.assertEqual(block["alternatives"], {"other_areas": [], "other_categories": []})
        self.assertTrue(block["message"])

    def test_other_categories_in_area_exclude_inactive_and_current_category(self):
        self.make_provider("Elec in Banani", self.electrician, area="Banani")
        self.make_provider("Pending Plumb", self.plumber, area="Gulshan", status="pending")
        block = self.analyze(area="Gulshan")
        names = [c["name"] for c in block["alternatives"]["other_categories"]]
        self.assertNotIn("Electrician", names)  # the category we already tried
        # Falls back to "anywhere" because nothing active in Gulshan: plumber
        # has no active providers at all, so the list is empty.
        self.assertEqual(names, [])

    def test_unrecognised_category_does_not_guess_a_provider_type(self):
        self.make_provider("Elec Eve", self.electrician)
        self.make_provider("Plumb Pat", self.plumber)
        block = self.analyze(category="Wizard")  # falls back -> category_fallback=True
        self.assertEqual(block["matches"], [])
        self.assertIn("couldn't match", block["message"])
        self.assertEqual(
            {c["name"] for c in block["alternatives"]["other_categories"]},
            {"Electrician", "Plumber"},
        )

    def test_bangla_messages_follow_the_users_language(self):
        self.make_provider("Banani Ben", self.electrician, area="Banani")
        block = self.analyze(problem="সিলিং ফ্যান ঘুরছে না", area="Gulshan")
        self.assertIn("এলাকায়", block["message"])
        block = self.analyze(problem="সিলিং ফ্যান ঘুরছে না", category="Wizard")
        self.assertIn("ক্যাটাগরি", block["message"])


# ════════════════════════════════════════════════════════════════
# Ranking
# ════════════════════════════════════════════════════════════════
class RankingTests(MatchingTestBase):
    def test_many_good_reviews_beat_one_perfect_review(self):
        lucky = self.make_provider("One Perfect", self.electrician)
        solid = self.make_provider("Solid Sam", self.electrician)
        self.rate(lucky, [5])
        self.rate(solid, [5, 4, 5, 4, 5, 4])  # avg 4.5, 6 reviews
        block = self.analyze()
        self.assertEqual(self.names(block), ["Solid Sam", "One Perfect"])

    def test_unrated_beats_badly_rated_but_loses_to_well_rated(self):
        good = self.make_provider("Good", self.electrician)
        unrated = self.make_provider("Unrated", self.electrician)
        bad = self.make_provider("Bad", self.electrician)
        self.rate(good, [5, 5, 5])
        self.rate(bad, [1, 2])
        block = self.analyze()
        self.assertEqual(self.names(block), ["Good", "Unrated", "Bad"])
        self.assertEqual(block["matches"][1]["review_count"], 0)
        self.assertEqual(block["matches"][1]["avg_rating"], 0.0)

    def test_ties_break_on_reviews_then_experience_then_id(self):
        junior = self.make_provider("Junior", self.electrician, experience=1)
        senior = self.make_provider("Senior", self.electrician, experience=9)
        block = self.analyze()
        self.assertEqual(self.names(block), ["Senior", "Junior"])
        self.assertIsNotNone(junior)

    def test_ranking_applies_inside_the_area_filter(self):
        a = self.make_provider("Gulshan Low", self.electrician, area="Gulshan")
        b = self.make_provider("Gulshan High", self.electrician, area="Gulshan")
        c = self.make_provider("Banani Best", self.electrician, area="Banani")
        self.rate(a, [3, 3, 3])
        self.rate(b, [5, 5, 5])
        self.rate(c, [5, 5, 5, 5, 5])
        block = self.analyze(area="Gulshan")
        self.assertEqual(self.names(block), ["Gulshan High", "Gulshan Low"])

    def test_results_are_capped(self):
        for i in range(8):
            self.make_provider(f"P{i}", self.electrician)
        block = self.analyze()
        self.assertEqual(len(block["matches"]), matching.MAX_MATCHES)

    def test_alternatives_are_capped_and_ranked(self):
        for i in range(6):
            p = self.make_provider(f"Far{i}", self.electrician, area="Banani")
            self.rate(p, [i % 5 + 1])
        block = self.analyze(area="Gulshan")
        alt = block["alternatives"]["other_areas"]
        self.assertEqual(len(alt), matching.MAX_ALTERNATIVE_PROVIDERS)
        ratings = [p["avg_rating"] for p in alt]
        self.assertEqual(ratings, sorted(ratings, reverse=True))

    def test_rating_numbers_in_response_are_correct(self):
        p = self.make_provider("Rated", self.electrician)
        self.rate(p, [5, 4])
        match = self.analyze()["matches"][0]
        self.assertEqual(match["review_count"], 2)
        self.assertEqual(match["avg_rating"], 4.5)


# ════════════════════════════════════════════════════════════════
# Privacy: no phone / email / user id
# ════════════════════════════════════════════════════════════════
class PrivacyTests(MatchingTestBase):
    def test_phone_and_email_never_appear_in_the_response(self):
        provider = self.make_provider(
            "Secret Sam", self.electrician, area="Gulshan", phone="01877665544"
        )
        far = self.make_provider(
            "Far Fay", self.electrician, area="Banani", phone="01899887766"
        )
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply()
            raw = self.client.post(
                self.url, {"problem": "Ceiling fan ghure na", "area": "Mirpur"},
                format="json", **self.auth,
            ).content.decode()

        for secret in ("01877665544", "01899887766", provider.user.email, far.user.email):
            self.assertNotIn(secret, raw)
        self.assertNotIn('"phone"', raw)
        self.assertNotIn('"email"', raw)

    def test_provider_objects_use_exactly_the_public_list_shape(self):
        self.make_provider("Shape Sue", self.electrician)
        match = self.analyze()["matches"][0]
        self.assertEqual(set(match), PUBLIC_PROVIDER_KEYS)
        self.assertNotIn("user_id", match)

    def test_alternative_providers_use_the_same_public_shape(self):
        self.make_provider("Far Fay", self.electrician, area="Banani")
        alt = self.analyze(area="Gulshan")["alternatives"]["other_areas"][0]
        self.assertEqual(set(alt), PUBLIC_PROVIDER_KEYS)

    def test_ai_prompt_never_contains_provider_data(self):
        self.make_provider("Secret Sam", self.electrician, phone="01877665544")
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply()
            self.client.post(self.url, {"problem": "Ceiling fan ghure na"},
                             format="json", **self.auth)
        sent = " ".join(mock_ai.call_args.args)
        self.assertNotIn("Secret Sam", sent)
        self.assertNotIn("01877665544", sent)


# ════════════════════════════════════════════════════════════════
# Input validation + resilience
# ════════════════════════════════════════════════════════════════
class AreaValidationAndResilienceTests(MatchingTestBase):
    @patch(MOCK_TARGET)
    def test_bad_area_input_returns_400_without_calling_ai(self, mock_ai):
        for bad in ("x" * 101, {"a": 1}, ["Gulshan"]):
            with self.subTest(area=bad):
                response = self.client.post(
                    self.url, {"problem": "Ceiling fan ghure na", "area": bad},
                    format="json", **self.auth,
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["status"], "error")
        mock_ai.assert_not_called()

    @patch("assistant.views.match_providers", side_effect=RuntimeError("db exploded"))
    def test_matching_failure_still_returns_the_ai_analysis(self, _):
        with patch(MOCK_TARGET) as mock_ai:
            mock_ai.return_value = ai_reply()
            response = self.client.post(
                self.url, {"problem": "Ceiling fan ghure na"}, format="json", **self.auth
            )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["urgency"], "low")           # analysis intact
        self.assertEqual(data["providers"]["matches"], [])
        self.assertIn("unavailable", data["providers"]["message"])
        self.assertNotIn("db exploded", json.dumps(data))   # no internals leaked

    def test_emergency_analysis_still_gets_provider_matches(self):
        self.make_provider("Rescue Ray", self.electrician)
        block = self.analyze(problem="Switchboard theke spark hocche")
        self.assertEqual(self.names(block), ["Rescue Ray"])


# ════════════════════════════════════════════════════════════════
# Pure functions
# ════════════════════════════════════════════════════════════════
class MatchingUnitTests(SimpleTestCase):
    def test_rank_score_is_damped_for_small_samples(self):
        self.assertLess(matching.rank_score(5.0, 1), matching.rank_score(4.5, 6))
        self.assertEqual(matching.rank_score(None, 0), matching.PRIOR_MEAN)

    def test_rank_score_rises_with_rating_and_reviews(self):
        self.assertGreater(matching.rank_score(5, 10), matching.rank_score(4, 10))
        self.assertGreater(matching.rank_score(4.5, 50), matching.rank_score(4.5, 2))

    def test_clean_area(self):
        self.assertEqual(matching.clean_area("  Gulshan\x00  2 "), "Gulshan 2")
        self.assertIsNone(matching.clean_area("   "))
        self.assertIsNone(matching.clean_area(None))
        self.assertIsNone(matching.clean_area(123))
        self.assertEqual(len(matching.clean_area("a" * 500)), matching.MAX_AREA_LENGTH)