"""Add refresh token families and a bounded rotation grace window.

Revision ID: ee55ff66aa77
Revises: dd44ee55ff66
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "ee55ff66aa77"
down_revision: str | Sequence[str] | None = "dd44ee55ff66"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("family_id", sa.Uuid(), nullable=True))
    op.add_column(
        "refresh_tokens",
        sa.Column("replaced_by_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("grace_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    connection = op.get_bind()
    token_ids = list(
        connection.execute(sa.text("SELECT id FROM refresh_tokens")).scalars()
    )
    for token_id in token_ids:
        connection.execute(
            sa.text("UPDATE refresh_tokens SET family_id = :family_id WHERE id = :id"),
            {"family_id": uuid.uuid4(), "id": token_id},
        )
    op.alter_column("refresh_tokens", "family_id", nullable=False)
    op.create_index(
        "ix_refresh_tokens_family_id",
        "refresh_tokens",
        ["family_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_column("refresh_tokens", "grace_expires_at")
    op.drop_column("refresh_tokens", "replaced_by_hash")
    op.drop_column("refresh_tokens", "family_id")
