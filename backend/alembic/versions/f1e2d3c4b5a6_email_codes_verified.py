"""email codes + verified user status

Revision ID: f1e2d3c4b5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-08-11

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Новый статус пользователя «почта подтверждена» (verified).
    # PostgreSQL не позволяет применить ADD VALUE внутри той же транзакции,
    # где значение используется, поэтому — autocommit_block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userstatus ADD VALUE 'verified'")

    op.create_table(
        "email_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum("verify_email", "reset_password", name="emailcodepurpose"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_email_codes_user_id"),
        "email_codes",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_email_codes_code_hash"),
        "email_codes",
        ["code_hash"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_email_codes_code_hash"), table_name="email_codes")
    op.drop_index(op.f("ix_email_codes_user_id"), table_name="email_codes")
    op.drop_table("email_codes")
    # Значение 'verified' из PG-enum удалить нельзя (нет DROP VALUE);
