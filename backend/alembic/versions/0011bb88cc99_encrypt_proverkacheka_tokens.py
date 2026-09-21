"""Envelope-encrypt existing Proverkacheka tokens.

Revision ID: 0011bb88cc99
Revises: ff66aa77bb88
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from src.core.config import settings
from src.core.encryption import EnvelopeEncryption, is_encrypted

revision: str = "0011bb88cc99"
down_revision: str | Sequence[str] | None = "ff66aa77bb88"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "proverkacheka_token",
        existing_type=sa.String(length=256),
        type_=sa.Text(),
        existing_nullable=True,
    )
    connection = op.get_bind()
    rows = list(
        connection.execute(
            sa.text(
                "SELECT id, proverkacheka_token FROM users "
                "WHERE proverkacheka_token IS NOT NULL"
            )
        )
    )
    if not rows:
        return
    cipher = EnvelopeEncryption(settings.proverkacheka_encryption_key)
    for user_id, token in rows:
        if is_encrypted(token):
            continue
        connection.execute(
            sa.text(
                "UPDATE users SET proverkacheka_token = :token WHERE id = :user_id"
            ),
            {"token": cipher.encrypt(token), "user_id": user_id},
        )


def downgrade() -> None:
    connection = op.get_bind()
    rows = list(
        connection.execute(
            sa.text(
                "SELECT id, proverkacheka_token FROM users "
                "WHERE proverkacheka_token IS NOT NULL"
            )
        )
    )
    if rows:
        cipher = EnvelopeEncryption(settings.proverkacheka_encryption_key)
        for user_id, token in rows:
            if not is_encrypted(token):
                continue
            connection.execute(
                sa.text(
                    "UPDATE users SET proverkacheka_token = :token WHERE id = :user_id"
                ),
                {"token": cipher.decrypt(token), "user_id": user_id},
            )
    op.alter_column(
        "users",
        "proverkacheka_token",
        existing_type=sa.Text(),
        type_=sa.String(length=256),
        existing_nullable=True,
    )
