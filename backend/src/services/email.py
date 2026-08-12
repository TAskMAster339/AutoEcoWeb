"""Отправка писем через SMTP (aiosmtplib).

Если SMTP не настроен (smtp_host/smtp_username пусты) — письмо не
отправляется, а код пишется в лог бэкенда (удобно для локальной разработки).
"""  # noqa: RUF002

import logging
from email.message import EmailMessage
from html import escape
from urllib.parse import urlencode

from fastapi import HTTPException, status
from src.core.config import settings
from src.core.enums.email_code_purpose import EmailCodePurpose

logger = logging.getLogger(__name__)

_APP_NAME = "AutoEco"

_PURPOSE_SUBJECTS: dict[EmailCodePurpose, str] = {
    EmailCodePurpose.VERIFY_EMAIL: "Подтверждение почты — AutoEco",
    EmailCodePurpose.RESET_PASSWORD: "Восстановление пароля — AutoEco",
}

_PURPOSE_TEXTS: dict[EmailCodePurpose, str] = {
    EmailCodePurpose.VERIFY_EMAIL: "Вы зарегистрировались в AutoEco. Код подтверждения почты:",  # noqa: E501
    EmailCodePurpose.RESET_PASSWORD: "Вы запросили восстановление пароля в AutoEco. Код для сброса:",  # noqa: E501, RUF001
}


class EmailService:
    """Отправляет одноразовые коды подтверждения на почту пользователя."""

    async def send_code(
        self,
        to_email: str,
        purpose: EmailCodePurpose,
        code: str,
    ) -> bool:
        """Отправляет письмо с кодом. Возвращает True, если письмо ушло.

        SMTP не настроен → код только в логе (dev), возвращает False.
        SMTP настроен, но доставка не удалась → 502 (иначе пользователь
        ждёт письмо, которого не будет).
        """  # noqa: RUF002
        if not settings.smtp_host or not settings.smtp_username:
            logger.warning(
                "SMTP не настроен: код %s для %s (назначение: %s) не отправлен. "
                "Укажите SMTP_* в .env",
                code,
                to_email,
                purpose.value,
            )
            return False

        message = self._build_message(to_email, purpose, code)
        try:
            await self._send(message)
        except Exception as exc:  # — любая ошибка SMTP-транзакции
            logger.exception("Ошибка отправки письма на %s: %s", to_email, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось отправить письмо — проверьте SMTP-настройки",  # noqa: RUF001
            ) from exc
        return True

    async def send_feedback_received(self, to_email: str, subject: str) -> bool:
        return await self._send_feedback_message(
            to_email,
            "Обращение получено — AutoEco",
            "Обращение получено",
            f"Мы получили ваше обращение «{subject}». Оно очень важно для нас. Администратор ответит вам по возможности скоро.",  # noqa: E501
        )

    async def send_feedback_answer(
        self,
        to_email: str,
        subject: str,
        reply: str,
    ) -> bool:
        return await self._send_feedback_message(
            to_email,
            "Ответ на обращение — AutoEco",
            "Ответ администратора",
            f"Администратор ответил на ваше обращение «{subject}».",
            reply,
        )

    async def _send_feedback_message(
        self,
        to_email: str,
        subject: str,
        heading: str,
        text: str,
        reply: str | None = None,
    ) -> bool:
        if not settings.smtp_host or not settings.smtp_username:
            logger.warning(
                "SMTP не настроен: письмо '%s' для %s не отправлено",
                subject,
                to_email,
            )
            return False
        sender = settings.smtp_from or settings.smtp_username or _APP_NAME
        safe_email = escape(to_email)
        reply_block = (
            f'<div style="margin:26px 0 0;padding:18px;background:#f3f2fb;border:1px solid #e5e2ff;border-radius:8px;font-size:16px;line-height:1.6;text-align:left;color:#303044;white-space:pre-wrap;">{escape(reply)}</div>'  # noqa: E501
            if reply
            else ""
        )
        html = f"""
<html><body style="margin:0;padding:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#17171c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e3e8;border-radius:12px;">
<tr><td style="padding:36px 40px 32px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr><td style="width:38px;height:38px;background:#6c5ce7;border-radius:8px;text-align:center;vertical-align:middle;color:#fff;font-size:22px;font-weight:700;">A</td><td style="padding-left:10px;font-size:22px;font-weight:700;color:#17171c;">{_APP_NAME}</td></tr></table>
<div style="font-size:28px;line-height:1.2;font-weight:700;color:#17171c;margin-bottom:14px;">{escape(heading)}</div>
<div style="font-size:16px;color:#4b4d57;line-height:1.6;">{escape(text)}</div>
{reply_block}
<div style="margin-top:26px;font-size:14px;color:#6f7280;line-height:1.55;">Если вы не ожидали это письмо, просто проигнорируйте его.</div>
</td></tr><tr><td style="padding:20px 40px;border-top:1px solid #ececf0;background:#fafafd;border-radius:0 0 12px 12px;text-align:center;font-size:12px;line-height:1.6;color:#858895;">Это автоматическое письмо, отвечать на него не нужно.<br />AutoEco · Помогаем держать расходы под контролем</td></tr>
</table><div style="max-width:560px;padding:18px 16px 0;text-align:center;font-size:11px;line-height:1.5;color:#9a9ca6;">Письмо отправлено на {safe_email}.</div>
</td></tr></table></body></html>
"""  # noqa: E501, RUF001
        message = EmailMessage()
        message["From"] = sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(f"{text}\n\n{reply or ''}".strip())
        message.add_alternative(html, subtype="html")
        try:
            await self._send(message)
        except Exception as exc:
            logger.exception("Ошибка отправки письма на %s: %s", to_email, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось отправить письмо",  # noqa: RUF001
            ) from exc
        return True

    def _build_message(
        self,
        to_email: str,
        purpose: EmailCodePurpose,
        code: str,
    ) -> EmailMessage:
        sender = settings.smtp_from or settings.smtp_username or "AutoEco"
        subject = _PURPOSE_SUBJECTS[purpose]
        text = _PURPOSE_TEXTS[purpose]
        safe_code = escape(code)
        safe_email = escape(to_email)
        action_label = (
            "Подтвердить почту"
            if purpose == EmailCodePurpose.VERIFY_EMAIL
            else "Перейти к восстановлению"
        )
        page_path = (
            "/verify-email" if purpose == EmailCodePurpose.VERIFY_EMAIL else "/recover"
        )
        action_url = f"{settings.app_url.rstrip('/')}{page_path}?{urlencode({'email': to_email})}"  # noqa: E501
        safe_action_url = escape(action_url, quote=True)
        ttl = settings.email_code_ttl_minutes
        html = f"""
<html>
  <body style="margin:0;padding:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#17171c;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Код AutoEco для подтверждения почты</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e3e8;border-radius:12px;">
            <tr>
              <td style="padding:36px 40px 32px;text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr>
                  <td style="width:38px;height:38px;background:#6c5ce7;border-radius:8px;text-align:center;vertical-align:middle;color:#ffffff;font-size:22px;font-weight:700;">A</td>
                  <td style="padding-left:10px;font-size:22px;font-weight:700;color:#17171c;">{_APP_NAME}</td>
                </tr></table>
                <div style="font-size:28px;line-height:1.2;font-weight:700;color:#17171c;margin-bottom:14px;text-align:center;">Подтвердите почту</div>
                <div style="font-size:16px;color:#4b4d57;line-height:1.6;text-align:center;">{escape(text)} Мы отправили код для адреса <strong>{safe_email}</strong>.</div>
                <div style="margin:26px 0 20px;padding:22px 12px;background:#f3f2fb;border:1px solid #e5e2ff;border-radius:8px;font-size:38px;line-height:1;font-weight:700;letter-spacing:10px;text-align:center;color:#5b43d6;">{safe_code}</div>
                <div style="font-size:14px;color:#6f7280;line-height:1.55;text-align:center;">Код действителен {ttl} минут. Если вы не запрашивали это письмо, просто проигнорируйте его.</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 0;"><tr><td align="center" style="border-radius:7px;background:#6c5ce7;">
                  <a href="{safe_action_url}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">{action_label}</a>
                </td></tr></table>
                <div style="margin-top:14px;text-align:center;font-size:12px;color:#9295a1;line-height:1.5;">Если кнопка не работает, откройте AutoEco и введите код вручную.</div>
              </td>
            </tr>
            <tr><td style="padding:20px 40px;border-top:1px solid #ececf0;background:#fafafd;border-radius:0 0 12px 12px;text-align:center;font-size:12px;line-height:1.6;color:#858895;">Это автоматическое письмо, отвечать на него не нужно.<br />AutoEco · Помогаем держать расходы под контролем</td></tr>
          </table>
          <div style="max-width:560px;padding:18px 16px 0;text-align:center;font-size:11px;line-height:1.5;color:#9a9ca6;">Письмо отправлено на {safe_email}. Берегите данные для входа и никому не сообщайте код.</div>
        </td>
      </tr>
    </table>
  </body>
</html>
"""  # noqa: E501, RUF001
        message = EmailMessage()
        message["From"] = sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(f"{text}\n\n{code}")
        message.add_alternative(html, subtype="html")
        return message

    async def _send(self, message: EmailMessage) -> None:
        import aiosmtplib

        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=settings.smtp_ssl,
            start_tls=settings.smtp_starttls and not settings.smtp_ssl,
            timeout=15,
        )
