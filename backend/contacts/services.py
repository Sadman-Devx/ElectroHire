"""
Shared helpers used by BOTH the REST message endpoint (views.py's
MessageListCreateView) and the real-time WebSocket consumer
(consumers.py's ChatConsumer).

Why this file exists: the WebSocket layer deliberately does not
re-implement "who is the other party in this thread" or "is this a
valid conversation" -- those rules already exist, tested, in the REST
view. Duplicating them in the consumer would just be a second place
for the two to quietly drift apart. Instead both entry points call the
same functions here.
"""

from django.contrib.auth import get_user_model

User = get_user_model()


def resolve_other_user(viewer, provider, with_user_id=None):
    """
    Given the authenticated `viewer` and the `provider` a thread
    belongs to, returns (other_user, error_message).

    - error_message is None on success, other_user is None on failure.
    - Customer's-eye view: the other party is always provider.user.
    - Provider's-eye view: request.user IS provider.user, so
      provider_id alone can't say *which* customer's thread this is (a
      provider has many customers, not one) -- `with_user_id` must name
      the customer explicitly.

    This mirrors MessageListCreateView._resolve_other_user exactly,
    minus the DRF Response wrapping, so it can also be called from an
    async Channels consumer, which has no HTTP response to build.
    """
    if viewer.id != provider.user_id:
        return provider.user, None

    if not with_user_id:
        return None, (
            "Provider replies require '?with=<customer_user_id>' to "
            "identify which conversation this is."
        )

    try:
        other_user = User.objects.get(id=with_user_id)
    except (User.DoesNotExist, ValueError, TypeError):
        return None, "User not found"

    if other_user.id == viewer.id:
        return None, "You cannot message yourself."

    return other_user, None


def chat_group_name(user_id_a, user_id_b):
    """
    Deterministic Channels group name for the conversation between two
    user ids, independent of which one is "sender" vs "receiver" on
    any given Message row -- a conversation needs exactly one stable
    group name regardless of who's currently sending, so both
    directions must resolve to the same string.
    """
    low, high = sorted([int(user_id_a), int(user_id_b)])
    return f"chat_{low}_{high}"


def broadcast_new_message(message):
    """
    Pushes a freshly created Message to both parties' open WebSocket
    connections (see ChatConsumer.chat_message), if any.

    Safe to call unconditionally:
      - group_send to a group nobody has joined is a documented no-op,
        so this is harmless when neither party has the chat window
        open.
      - get_channel_layer() returning None (CHANNEL_LAYERS missing from
        settings in some environment) just skips the broadcast --
        the REST response the sender already received is unaffected
        either way, so a misconfigured channel layer degrades to
        "poll/refresh to see new messages" rather than a 500.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group_name = chat_group_name(message.sender_id, message.receiver_id)
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "chat.message",
            "message": {
                "id": message.id,
                "sender_id": message.sender_id,
                "sender_name": message.sender.name,
                "content": message.content,
                "created_at": message.created_at.isoformat(),
                "is_read": message.is_read,
            },
        },
    )