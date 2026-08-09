"""Add explicit foreign keys from normalized values to aliases.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("name_alias_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("seller_name_alias_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "receipts",
        sa.Column("seller_name_alias_id", sa.Uuid(), nullable=True),
    )

    op.create_foreign_key(
        "fk_transactions_name_alias_id_aliases",
        "transactions",
        "aliases",
        ["name_alias_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_transactions_seller_name_alias_id_aliases",
        "transactions",
        "aliases",
        ["seller_name_alias_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_receipts_seller_name_alias_id_aliases",
        "receipts",
        "aliases",
        ["seller_name_alias_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_transactions_name_alias_id",
        "transactions",
        ["name_alias_id"],
    )
    op.create_index(
        "ix_transactions_seller_name_alias_id",
        "transactions",
        ["seller_name_alias_id"],
    )
    op.create_index(
        "ix_receipts_seller_name_alias_id",
        "receipts",
        ["seller_name_alias_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_receipts_seller_name_alias_id", table_name="receipts")
    op.drop_index("ix_transactions_seller_name_alias_id", table_name="transactions")
    op.drop_index("ix_transactions_name_alias_id", table_name="transactions")
    op.drop_constraint(
        "fk_receipts_seller_name_alias_id_aliases",
        "receipts",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_transactions_seller_name_alias_id_aliases",
        "transactions",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_transactions_name_alias_id_aliases",
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("receipts", "seller_name_alias_id")
    op.drop_column("transactions", "seller_name_alias_id")
    op.drop_column("transactions", "name_alias_id")

