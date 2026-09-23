"""Outbound email for invitations.

Uses smtplib (stdlib) with SMTP_* settings. When SMTP_HOST is empty the
"email" is logged instead so local/dev environments can still exercise the
invite flow (the invite link is always returned by the API either way).
"""

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger("devdiagnose.mail")


def _render_invite(name: str, invite_url: str) -> tuple[str, str]:
    subject = f"You've been invited to DevDiagnose"
    text = (
        f"Hi {name},\n\n"
        f"You've been invited to join your team's DevDiagnose workspace.\n\n"
        f"Set up your profile here:\n{invite_url}\n\n"
        f"This link expires in 72 hours.\n\n"
        f"Thanks,\nDevDiagnose"
    )
    html = (
        f"<p>Hi {name},</p>"
        f"<p>You've been invited to join your team's DevDiagnose workspace.</p>"
        f'<p><a href="{invite_url}">Set up your profile here</a></p>'
        f"<p>This link expires in 72 hours.</p>"
        f"<p>Thanks,<br>DevDiagnose</p>"
    )
    return subject, text, html


def send_invite_email(to_email: str, name: str = "there", invite_url: str = "") -> bool:
    """Send the invitation. Returns whether the message was actually mailed.

    If SMTP is not configured, logs the invite link and returns False.
    """
    settings = get_settings()
    subject, text, html = _render_invite(name, invite_url)

    if not settings.smtp_host:
        logger.info("[mail demo] invite for %s (%s): %s", name, to_email, invite_url)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("invitation emailed to %s", to_email)
        return True
    except Exception as exc:  # noqa: BLE001
        # Never fail the invite because mail is down; the link is still returned.
        logger.warning("failed to email invite to %s: %s", to_email, exc)
        return False