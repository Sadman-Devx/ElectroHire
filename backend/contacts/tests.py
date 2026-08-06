from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from providers.models import Provider
from .models import ContactLog, Message

User = get_user_model()


class ContactCreateViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            name="Test User",
            phone="01700000000",
            password="strongpassword123",
            role="user",
        )
        self.provider_user = User.objects.create_user(
            email="provider@example.com",
            name="Karim Uddin",
            phone="01711111111",
            password="strongpassword123",
            role="provider",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            area="Dhanmondi",
            experience=8,
            description="Professional electrician.",
            status="active",
        )
        self.url = reverse("contacts:contact-create")

    def _auth(self):
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_request_rejected(self):
        response = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_creates_contact_log(self):
        self._auth()
        response = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["provider_name"], "Karim Uddin")
        self.assertEqual(ContactLog.objects.count(), 1)

    def test_repeated_contact_does_not_duplicate(self):
        self._auth()
        first = self.client.post(self.url, {"provider_id": self.provider.id})
        second = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(ContactLog.objects.count(), 1)
        self.assertEqual(
            first.data["data"]["contact_id"],
            second.data["data"]["contact_id"],
        )

    def test_missing_provider_id(self):
        self._auth()
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")

    def test_invalid_provider_id(self):
        self._auth()
        response = self.client.post(self.url, {"provider_id": 999999})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")


class MessageListCreateViewTests(APITestCase):
    """Day 7, Dev 1 — GET/POST /api/contacts/messages/{provider_id}/"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            name="Mahmudul",
            phone="01700000000",
            password="strongpassword123",
            role="user",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            name="Rahim",
            phone="01700000099",
            password="strongpassword123",
            role="user",
        )
        self.provider_user = User.objects.create_user(
            email="provider@example.com",
            name="Karim Uddin",
            phone="01711111111",
            password="strongpassword123",
            role="provider",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            area="Dhanmondi",
            experience=8,
            description="Professional electrician.",
            status="active",
        )
        self.url = reverse(
            "contacts:message-thread", kwargs={"provider_id": self.provider.id}
        )

    def _auth_as(self, user):
        self.client.force_authenticate(user=user)

    # ── Auth guard ──────────────────────────────────────────────
    def test_get_unauthenticated_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_post_unauthenticated_rejected(self):
        response = self.client.post(self.url, {"content": "hi"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── 404 ─────────────────────────────────────────────────────
    def test_unknown_provider_returns_404(self):
        self._auth_as(self.user)
        url = reverse("contacts:message-thread", kwargs={"provider_id": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["status"], "error")

    # ── Provider's-eye view needs ?with= ────────────────────────
    def test_provider_without_with_param_gets_400(self):
        self._auth_as(self.provider_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provider_with_unknown_with_param_gets_404(self):
        self._auth_as(self.provider_user)
        response = self.client.get(self.url, {"with": 999999})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_provider_cannot_target_self_via_with_param(self):
        self._auth_as(self.provider_user)
        response = self.client.get(self.url, {"with": self.provider_user.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Sending a message ───────────────────────────────────────
    def test_send_message_creates_message_and_contact_log(self):
        self._auth_as(self.user)
        response = self.client.post(self.url, {"content": "AC thanda hocche na"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["content"], "AC thanda hocche na")
        self.assertIn("id", response.data["data"])
        self.assertIn("created_at", response.data["data"])

        message = Message.objects.get()
        self.assertEqual(message.sender, self.user)
        self.assertEqual(message.receiver, self.provider_user)

        # Sending a message counts as "contacting" the provider (App Build
        # doc: chat start -> contact_logs entry), same as reveal-number.
        self.assertTrue(
            ContactLog.objects.filter(user=self.user, provider=self.provider).exists()
        )

    def test_send_message_does_not_duplicate_contact_log(self):
        self._auth_as(self.user)
        self.client.post(self.url, {"content": "first message"})
        self.client.post(self.url, {"content": "second message"})
        self.assertEqual(
            ContactLog.objects.filter(user=self.user, provider=self.provider).count(), 1
        )
        self.assertEqual(Message.objects.count(), 2)

    def test_send_empty_content_rejected(self):
        self._auth_as(self.user)
        response = self.client.post(self.url, {"content": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(Message.objects.count(), 0)

    def test_send_missing_content_rejected(self):
        self._auth_as(self.user)
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provider_can_reply_via_with_param(self):
        self._auth_as(self.user)
        self.client.post(self.url, {"content": "Hi Karim"})

        self._auth_as(self.provider_user)
        # Provider replies through the SAME endpoint, disambiguated by
        # ?with=<customer_user_id> since provider_id alone is their own id.
        response = self.client.post(
            f"{self.url}?with={self.user.id}", {"content": "Ji, kal ashte parbo"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.latest("id")
        self.assertEqual(message.sender, self.provider_user)
        self.assertEqual(message.receiver, self.user)

    def test_provider_reply_does_not_create_duplicate_contact_log(self):
        self._auth_as(self.user)
        self.client.post(self.url, {"content": "Hi Karim"})
        self.assertEqual(ContactLog.objects.count(), 1)

        self._auth_as(self.provider_user)
        self.client.post(f"{self.url}?with={self.user.id}", {"content": "reply"})
        # Provider replying never creates its own ContactLog row.
        self.assertEqual(ContactLog.objects.count(), 1)

    def test_provider_can_read_thread_via_with_param(self):
        Message.objects.create(sender=self.user, receiver=self.provider_user, content="hi")

        self._auth_as(self.provider_user)
        response = self.client.get(f"{self.url}?with={self.user.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["content"], "hi")

    # ── Reading a thread ────────────────────────────────────────
    def test_get_returns_full_thread_in_order(self):
        Message.objects.create(
            sender=self.user, receiver=self.provider_user, content="msg1"
        )
        Message.objects.create(
            sender=self.provider_user, receiver=self.user, content="msg2"
        )

        self._auth_as(self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["content"], "msg1")
        self.assertEqual(data[0]["sender_id"], self.user.id)
        self.assertEqual(data[0]["sender_name"], "Mahmudul")
        self.assertEqual(data[1]["content"], "msg2")
        self.assertEqual(data[1]["sender_id"], self.provider_user.id)

    def test_get_only_returns_this_threads_messages(self):
        # Message with an unrelated third user must never leak into
        # this provider's thread.
        Message.objects.create(
            sender=self.user, receiver=self.provider_user, content="in-thread"
        )
        Message.objects.create(
            sender=self.user, receiver=self.other_user, content="unrelated"
        )

        self._auth_as(self.user)
        response = self.client.get(self.url)
        contents = [m["content"] for m in response.data["data"]]
        self.assertEqual(contents, ["in-thread"])

    def test_get_marks_incoming_messages_as_read(self):
        incoming = Message.objects.create(
            sender=self.provider_user,
            receiver=self.user,
            content="unread msg",
            is_read=False,
        )

        self._auth_as(self.user)
        response = self.client.get(self.url)
        # Response reflects state *as of opening* the thread.
        self.assertFalse(response.data["data"][0]["is_read"])

        incoming.refresh_from_db()
        self.assertTrue(incoming.is_read)

    def test_get_does_not_mark_own_sent_messages(self):
        Message.objects.create(
            sender=self.user, receiver=self.provider_user, content="from me", is_read=False
        )
        self._auth_as(self.user)
        self.client.get(self.url)
        message = Message.objects.get()
        self.assertFalse(message.is_read)


class ConversationListViewTests(APITestCase):
    """Day 7, Dev 1 — GET /api/contacts/conversations/"""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            name="Mahmudul",
            phone="01700000000",
            password="strongpassword123",
            role="user",
        )

        self.karim_user = User.objects.create_user(
            email="karim@example.com",
            name="Karim Uddin",
            phone="01711111111",
            password="strongpassword123",
            role="provider",
        )
        self.karim = Provider.objects.create(
            user=self.karim_user, area="Dhanmondi", experience=8, status="active"
        )

        self.rahim_user = User.objects.create_user(
            email="rahim@example.com",
            name="Rahim Plumber",
            phone="01722222222",
            password="strongpassword123",
            role="provider",
        )
        self.rahim = Provider.objects.create(
            user=self.rahim_user, area="Mirpur", experience=5, status="active"
        )

        self.url = reverse("contacts:conversation-list")

    def _auth(self):
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_when_no_messages(self):
        self._auth()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"], [])
        self.assertEqual(response.data["count"], 0)

    def test_lists_conversation_with_last_message_and_unread_count(self):
        Message.objects.create(
            sender=self.user, receiver=self.karim_user, content="hi", is_read=True
        )
        Message.objects.create(
            sender=self.karim_user,
            receiver=self.user,
            content="latest reply",
            is_read=False,
        )

        self._auth()
        response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 1)
        convo = response.data["data"][0]
        self.assertEqual(convo["provider_id"], self.karim.id)
        self.assertEqual(convo["other_user_name"], "Karim Uddin")
        self.assertEqual(convo["other_user_role"], "provider")
        self.assertEqual(convo["last_message"], "latest reply")
        self.assertEqual(convo["unread_count"], 1)

    def test_multiple_conversations_sorted_newest_first(self):
        Message.objects.create(sender=self.user, receiver=self.karim_user, content="older")
        Message.objects.create(sender=self.user, receiver=self.rahim_user, content="newer")

        self._auth()
        response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 2)
        names = [c["other_user_name"] for c in response.data["data"]]
        self.assertEqual(names, ["Rahim Plumber", "Karim Uddin"])

    def test_unread_count_only_counts_incoming_unread(self):
        Message.objects.create(
            sender=self.user, receiver=self.karim_user, content="from me", is_read=False
        )
        Message.objects.create(
            sender=self.karim_user, receiver=self.user, content="to me", is_read=False
        )

        self._auth()
        response = self.client.get(self.url)
        convo = response.data["data"][0]
        # Only the message the provider sent TO the user counts as unread
        # for this user — a user's own outgoing message is never "unread".
        self.assertEqual(convo["unread_count"], 1)

    def test_other_users_conversations_not_visible(self):
        stranger = User.objects.create_user(
            email="stranger@example.com",
            name="Stranger",
            phone="01733333333",
            password="strongpassword123",
            role="user",
        )
        Message.objects.create(sender=stranger, receiver=self.karim_user, content="hi karim")

        self._auth()
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"], [])