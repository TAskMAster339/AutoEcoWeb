"""Add immutable and normalized seller names.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "receipts",
        sa.Column("normalized_seller_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("normalized_seller_name", sa.String(length=255), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE receipts SET normalized_seller_name = seller_name "
            "WHERE normalized_seller_name IS NULL",
        ),
    )
    op.execute(
        sa.text(
            "UPDATE transactions SET normalized_seller_name = seller_name "
            "WHERE normalized_seller_name IS NULL AND seller_name IS NOT NULL",
        ),
    )
    op.alter_column("receipts", "normalized_seller_name", nullable=False)


def downgrade() -> None:
    op.drop_column("transactions", "normalized_seller_name")
    op.drop_column("receipts", "normalized_seller_name")
