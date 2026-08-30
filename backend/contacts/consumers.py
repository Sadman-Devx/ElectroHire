"""
Real-time companion to MessageListCreateView (contacts/views.py).

Route (contacts/routing.py):
    ws://.../ws/chat/<provider_id>/?token=<jwt_access_token>[&with=<customer_user_id>]

Deliberately thin: this consumer never creates a Message itself.
Sending a message still goes through
POST /api/contacts/messages/{provider_id}/ (already validated,
permission-checked, and the one place a ContactLog gets written) --
that view calls services.broadcast_new_message() right after saving,
which is what actually reaches this consumer's chat_message() handler
below. Splitting "send" (REST, one source of truth) from "receive
instantly" (WebSocket) avoids re-implementing the same
validation/eligibility rules in two places where they could quietly
drift apart.

What this DOES own: authenticating the socket, joining/leaving the
right broadcast group, and relaying lightweight "typing" events
between the two parties -- none of that needs to touch the database
write path or duplicate the REST contract.
"""

import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from providers.models import Provider

from .services import chat_group_name, resolve_other_user

User = get_user_model()

# Close codes in the 4000-4999 range are reserved for applications
# (RFC 6455) -- used here so the frontend can tell "you're not logged
# in" apart from "that provider/thread doesn't exist" and react
# differently (e.g. redirect to /login vs show a generic error).
CLOSE_UNAUTHENTICATED = 4401
CLOSE_NOT_FOUND = 4404
CLOSE_BAD_REQUEST = 4400


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = await self._authenticate()
        if self.user is None:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        provider_id = self.scope["url_route"]["kwargs"]["provider_id"]
        provider = await self._get_provider(provider_id)
        if provider is None:
            await self.close(code=CLOSE_NOT_FOUND)
            return

        query = parse_qs(self.scope["query_string"].decode())
        with_user_id = (query.get("with") or [None])[0]

        other_user, error_message = await self._resolve_other_user(
            provider, with_user_id
        )
        if error_message:
            await self.close(code=CLOSE_BAD_REQUEST)
            return

        self.group_name = chat_group_name(self.user.id, other_user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except (TypeError, ValueError):
            return  # Malformed frame -- ignore rather than crash the socket.

        if payload.get("type") == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat.typing",
                    "user_id": self.user.id,
                    "is_typing": bool(payload.get("is_typing")),
                },
            )
        # Any other/unknown event type is silently ignored on purpose --
        # this socket is receive-and-typing only; message *creation*
        # only ever happens through the REST endpoint (see module
        # docstring), so there is deliberately no "send_message" case
        # here for a malicious or buggy client to abuse.

    # --- group event handlers (invoked via channel_layer.group_send) ----

    async def chat_message(self, event):
        """Relays a message broadcast by services.broadcast_new_message()."""
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
        }))

    async def chat_typing(self, event):
        # Every member of the group receives group_send, including the
        # sender -- only the OTHER party's UI should show "typing...".
        if event["user_id"] == self.user.id:
            return
        await self.send(text_data=json.dumps({
            "type": "typing",
            "user_id": event["user_id"],
            "is_typing": event["is_typing"],
        }))

    # --- helpers (DB access must be wrapped for an async consumer) ------

    @database_sync_to_async
    def _authenticate(self):
        """
        Browsers' native WebSocket API can't set an Authorization
        header, so the JWT access token travels as ?token=... instead
        -- same token apiClient.js already attaches to REST calls, just
        relocated to the query string for this one connection type.
        """
        query = parse_qs(self.scope["query_string"].decode())
        token = (query.get("token") or [None])[0]
        if not token:
            return None
        try:
            access = AccessToken(token)
            return User.objects.get(id=access["user_id"])
        except (TokenError, User.DoesNotExist, KeyError):
            return None

    @database_sync_to_async
    def _get_provider(self, provider_id):
        return Provider.objects.select_related("user").filter(id=provider_id).first()

    @database_sync_to_async
    def _resolve_other_user(self, provider, with_user_id):
        return resolve_other_user(self.user, provider, with_user_id)