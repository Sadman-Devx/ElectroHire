"""
Hides contact details (phone numbers, e-mails, messenger links) in chat
text, so a provider can't say "call me outside the app, I'll charge less".

Why: keeping the conversation, the booking, the rating and the
commission record on the platform is what makes the provider-only
commission model work. Masking is one layer (the other is showing
customers WHY staying on the platform protects them -- ratings, reviews,
reporting). It is deliberately a *speed bump*, not a wall: someone
determined can always spell a number out in words. We catch the common,
accidental and lazy cases:

  - Bangladeshi mobile numbers in any spacing: 01711223344,
    +880 1711-223344, 017 1122 3344, 8801711223344
  - Bangla digits too: ০১৭১১২২৩৩৪৪
  - any other run of 10+ digits (international numbers), except things
    that clearly look like dates
  - e-mail addresses
  - links to messengers / social apps / link shorteners (wa.me, t.me,
    m.me, facebook, instagram, imo, bit.ly ...)

Used by contacts/serializers.py (chat messages) and
bookings/serializers.py (booking description, which is also free text a
customer could put a phone number in).

`mask_contact_info(text)` -> (masked_text, was_masked)
"""

import re

MASK_TEXT = "[contact hidden]"

# 1:1 character mapping, so the normalized string has the SAME length as
# the original and match positions can be applied to the original text.
_BANGLA_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

# Optional +88 / 88 country code, optional leading 0, then 1[3-9] + 8
# more digits (operator prefix 013-019), with optional single
# space / dot / dash between any two digits.
_BD_MOBILE = re.compile(
    r"(?<!\d)"
    r"(?:\+?\s?88[\s.\-]*)?"
    r"(?:0[\s.\-]?)?"
    r"1[\s.\-]?[3-9]"
    r"(?:[\s.\-]?\d){8}"
    r"(?!\d)"
)

# Any other 10+ digit run (separators allowed between digits).
_LONG_DIGITS = re.compile(r"(?<!\d)\d(?:[\s.\-]?\d){9,}(?!\d)")

_DATE_LIKE = re.compile(
    r"^\s*(?:\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2}|\d{1,2}[\-/.]\d{1,2}[\-/.]\d{2,4})\s*$"
)

_EMAIL = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")

_SOCIAL_LINK = re.compile(
    r"(?:https?://)?(?:www\.)?"
    r"(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|m\.me|"
    r"messenger\.com|facebook\.com|fb\.com|fb\.me|instagram\.com|imo\.im|"
    r"bit\.ly|tinyurl\.com)"
    r"(?:/\S*)?",
    re.IGNORECASE,
)


def mask_contact_info(text):
    """Returns (masked_text, was_masked). Never raises on odd input."""
    if not text:
        return text or "", False

    normalized = text.translate(_BANGLA_DIGITS)

    spans = []
    for pattern in (_BD_MOBILE, _EMAIL, _SOCIAL_LINK):
        spans.extend((m.start(), m.end()) for m in pattern.finditer(normalized))
    for match in _LONG_DIGITS.finditer(normalized):
        if _DATE_LIKE.match(match.group()):
            continue
        spans.append((match.start(), match.end()))

    if not spans:
        return text, False

    # Merge overlapping/adjacent spans so one number is replaced once.
    spans.sort()
    merged = [list(spans[0])]
    for start, end in spans[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    pieces = []
    cursor = 0
    for start, end in merged:
        pieces.append(text[cursor:start])
        pieces.append(MASK_TEXT)
        cursor = end
    pieces.append(text[cursor:])
    return "".join(pieces), True