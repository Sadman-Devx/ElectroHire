from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.response import success_response, error_response, first_error_message
from providers.models import Provider
from .models import ContactLog, Message
from .services import broadcast_new_message, resolve_other_user
from .serializers import (
    ContactCheckSerializer,
    ContactCreateSerializer,
    ContactHistoryItemSerializer,
    ContactLogResponseSerializer,
    ConversationSerializer,
    MessageCreateResponseSerializer,
    MessageListItemSerializer,
    MessageSendSerializer,
)

User = get_user_model()


class ContactCreateView(APIView):
    """
    POST /api/contacts/
    Auth required. Creates (or returns the existing) ContactLog for the
    authenticated user + given provider. Idempotent by design — calling
    this repeatedly for the same provider (e.g. on 'reveal number') never
    creates a duplicate row.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ContactCreateSerializer(data=request.data)
        if not serializer.is_valid():
            # Day 10, Dev 2: was `next(iter(serializer.errors.values()))[0]`
            # — only ever safe here because provider_id is a plain
            # IntegerField that can't itself produce a nested error. Switched
            # to the shared helper anyway so this view can't silently regress
            # into the same raw-repr bug core.response.first_error_message
            # was just fixed for (see its docstring) if this serializer ever
            # grows a ListField/nested field later.
            return error_response(
                message=first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        provider_id = serializer.validated_data["provider_id"]
        provider = Provider.objects.select_related("user").get(id=provider_id)

        contact_log, _created = ContactLog.objects.get_or_create(
            user=request.user,
            provider=provider,
        )

        response_data = ContactLogResponseSerializer(contact_log).data
        return success_response(
            data=response_data,
            message="Contact logged",
            status_code=status.HTTP_201_CREATED,
        )


# -- Dev 1, Day 9 ---------------------------------------------------------
class ContactCheckView(APIView):
    """
    GET /api/contacts/check/{provider_id}/

    Not in the API Contract PDF — added to back the Rating button's
    enable/disable state on ProviderDetailPage (Day 9 schedule: "Contact
    Log Eligibility Check (Rating Button Enable/Disable)"). Without this,
    the frontend's only way to learn whether a user is rating-eligible
    was to let them fill out the whole rating form and find out from a
    400 on submit (see ratings/views.py RatingCreateView) — a real but
    late failure mode this endpoint lets the UI pre-empt.

    Auth required, same as the eligibility check it mirrors. Read-only,
    no side effects — checking eligibility must not itself create a
    ContactLog (that would let a user rate without ever actually
    contacting the provider).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, provider_id):
        if not Provider.objects.filter(id=provider_id).exists():
            return error_response("Provider not found", status.HTTP_404_NOT_FOUND)

        has_contacted = ContactLog.objects.filter(
            user=request.user, provider_id=provider_id
        ).exists()

        data = ContactCheckSerializer(
            {"has_contacted": has_contacted, "provider_id": int(provider_id)}
        ).data
        return success_response(data=data)


# -- Dev 1, Day 9 ---------------------------------------------------------
class ContactHistoryView(APIView):
    """
    GET /api/contacts/history/

    Not in the API Contract PDF — added to back the User Account Page's
    "Contact History" section (Day 9 schedule, Dev 1: "Profile Info + My
    Ratings + Contact History"). Every provider the authenticated user
    has ever contacted (POST /api/contacts/ or a first chat message —
    see MessageListCreateView.post, which also logs a ContactLog),
    newest first.

    Auth required. select_related keeps this to one query regardless of
    how many providers are returned, same reasoning as ConversationListView.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = ContactLog.objects.filter(user=request.user).select_related(
            "provider", "provider__user"
        )
        data = ContactHistoryItemSerializer(
            logs, many=True, context={"request": request}
        ).data
        return success_response(data=data, count=len(data))


class MessageListCreateView(APIView):
    """
    GET  /api/contacts/messages/{provider_id}/  -> full message thread
    POST /api/contacts/messages/{provider_id}/  -> send a message

    `provider_id` is a Provider PK, exactly like everywhere else this app
    uses "provider_id" (POST /api/contacts/, /api/providers/{id}/, etc) —
    never a raw User id.

    Two callers use this same route:
      - The customer messaging that provider -> the other party is simply
        provider.user. This is the case the API Contract's example shows
        (Mahmudul messaging Karim).
      - The provider replying -> request.user IS provider.user, so
        provider_id alone can't tell us *which* customer's thread this is
        (a provider has many customers, not one). The customer's user id
        must be passed as `?with=<user_id>` — Conversation List already
        returns each thread's `other_user_id` for exactly this purpose, so
        the frontend never has to guess it. ASSUMPTION flagged here since
        the API Contract PDF only documents the customer-side call.

    Sending a message here also logs a ContactLog entry (get_or_create, so
    it's a no-op after the first message) whenever the *customer* is the
    sender. Per the App Build doc's user flow — "Chat শুরু করবে ...
    contact_logs entry create হবে" — starting a chat counts as contacting
    the provider, same as the reveal-number flow ContactCreateView already
    handles. Without this, a user who only ever chats (never calls
    POST /api/contacts/) would incorrectly stay rating-ineligible.
    """

    permission_classes = [IsAuthenticated]

    def _resolve_other_user(self, request, provider):
        """
        Returns (other_user, error_response_or_None).

        Thin DRF wrapper around services.resolve_other_user, which now
        holds the actual rule (kept there, not here, so
        ChatConsumer -- contacts/consumers.py -- can call the exact
        same logic without importing anything DRF-specific).
        """
        other_user_id = request.query_params.get("with")
        other_user, error_message = resolve_other_user(
            request.user, provider, other_user_id
        )
        if error_message:
            status_code = (
                status.HTTP_404_NOT_FOUND
                if error_message == "User not found"
                else status.HTTP_400_BAD_REQUEST
            )
            return None, error_response(error_message, status_code)
        return other_user, None

    def _resolve_provider(self, provider_id):
        try:
            return (
                Provider.objects.select_related("user").get(id=provider_id),
                None,
            )
        except Provider.DoesNotExist:
            return None, error_response("Provider not found", status.HTTP_404_NOT_FOUND)

    def get(self, request, provider_id):
        provider, err = self._resolve_provider(provider_id)
        if err:
            return err

        other_user, err = self._resolve_other_user(request, provider)
        if err:
            return err

        thread = Message.objects.filter(
            Q(sender=request.user, receiver=other_user)
            | Q(sender=other_user, receiver=request.user)
        ).select_related("sender")

        data = MessageListItemSerializer(thread, many=True).data

        # Opening the thread marks the other party's messages as read —
        # this happens *after* serializing, so the response still reflects
        # is_read as it was the moment the thread was opened.
        thread.filter(sender=other_user, receiver=request.user, is_read=False).update(
            is_read=True
        )

        return success_response(data=data)

    def post(self, request, provider_id):
        provider, err = self._resolve_provider(provider_id)
        if err:
            return err

        other_user, err = self._resolve_other_user(request, provider)
        if err:
            return err

        serializer = MessageSendSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors), status.HTTP_400_BAD_REQUEST
            )

        message = Message.objects.create(
            sender=request.user,
            receiver=other_user,
            content=serializer.validated_data["content"],
        )

        # Only the customer side of this pair "contacts" a provider — skip
        # this when the provider themselves is the one sending (replying).
        if request.user.id != provider.user_id:
            ContactLog.objects.get_or_create(user=request.user, provider=provider)

        # Real-time push: instantly delivers this message to the other
        # party's open chat window (ChatConsumer, contacts/consumers.py)
        # if they have one connected. Sending itself still goes through
        # this same REST endpoint either way -- this just means whoever
        # is on the other end doesn't have to wait for their next 5s
        # poll to see it. A no-op if nobody has that thread open.
        broadcast_new_message(message)

        response_data = MessageCreateResponseSerializer(message).data
        return success_response(data=response_data, status_code=status.HTTP_201_CREATED)


class ConversationListView(APIView):
    """
    GET /api/contacts/conversations/  (Day 7, Dev 1 — not in the API
    Contract PDF; shape designed from the schedule's requirement: "সব
    Active Conversation-এর Last Message + Unread Count").

    Returns every conversation the authenticated user is part of (as
    either sender or receiver of at least one Message), newest last-message
    first, each with the other party's info, last message, and unread
    count — what Dev 3's Chat Page left panel needs.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        other_user_ids = set(
            Message.objects.filter(sender=user).values_list("receiver_id", flat=True)
        ) | set(
            Message.objects.filter(receiver=user).values_list("sender_id", flat=True)
        )

        conversations = []
        if other_user_ids:
            other_users = User.objects.filter(id__in=other_user_ids).select_related(
                "provider_profile"
            )

            for other_user in other_users:
                thread = Message.objects.filter(
                    Q(sender=user, receiver=other_user) | Q(sender=other_user, receiver=user)
                )
                last_message = thread.order_by("-created_at").first()
                unread_count = thread.filter(
                    sender=other_user, receiver=user, is_read=False
                ).count()

                provider = getattr(other_user, "provider_profile", None) or getattr(
                    user, "provider_profile", None
                )

                conversations.append(
                    {
                        "provider_id": provider.id if provider else None,
                        "other_user_id": other_user.id,
                        "other_user_name": other_user.name,
                        "other_user_role": other_user.role,
                        "last_message": last_message.content if last_message else "",
                        "last_message_at": last_message.created_at if last_message else None,
                        "unread_count": unread_count,
                    }
                )

            _MIN_DT = datetime.min.replace(tzinfo=dt_timezone.utc)
            conversations.sort(
                key=lambda c: c["last_message_at"] or _MIN_DT, reverse=True
            )

        data = ConversationSerializer(conversations, many=True).data
        return success_response(data=data, count=len(data))