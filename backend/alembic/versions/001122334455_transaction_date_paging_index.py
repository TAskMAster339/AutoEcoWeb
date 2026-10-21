"""Add the transaction keyset paging index.

Revision ID: 001122334455
Revises: 0011bb88cc99
"""

from collections.abc import Sequence

from alembic import op

revision: str = "001122334455"
down_revision: str | Sequence[str] | None = "0011bb88cc99"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_transactions_user_check_datetime_id",
        "transactions",
        ["user_id", "datetime", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transactions_user_check_datetime_id",
        table_name="transactions",
    )
