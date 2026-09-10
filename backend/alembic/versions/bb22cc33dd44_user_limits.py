"""add per-user limits

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "bb22cc33dd44"
down_revision: str | Sequence[str] | None = "aa11bb22cc33"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_limits",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("max_tags", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("max_seller_aliases", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("max_product_aliases", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("max_receipts", sa.Integer(), nullable=False, server_default="10000"),
        sa.Column("max_transactions", sa.Integer(), nullable=False, server_default="50000"),
        sa.Column("max_receipt_items", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("max_import_rows", sa.Integer(), nullable=False, server_default="5000"),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("max_tags >= 0", name="ck_user_limits_max_tags_nonnegative"),
        sa.CheckConstraint("max_seller_aliases >= 0", name="ck_user_limits_max_seller_aliases_nonnegative"),
        sa.CheckConstraint("max_product_aliases >= 0", name="ck_user_limits_max_product_aliases_nonnegative"),
        sa.CheckConstraint("max_receipts >= 0", name="ck_user_limits_max_receipts_nonnegative"),
        sa.CheckConstraint("max_transactions >= 0", name="ck_user_limits_max_transactions_nonnegative"),
        sa.CheckConstraint("max_receipt_items >= 0", name="ck_user_limits_max_receipt_items_nonnegative"),
        sa.CheckConstraint("max_import_rows >= 0", name="ck_user_limits_max_import_rows_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_limits_user_id"),
    )
    # Briefly block concurrent registrations so the backfill cannot miss a user
    # created between its snapshot and commit during a rolling deployment.
    op.execute(sa.text("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE"))
    # Use the user UUID as the initial row UUID: no database extension is required.
    op.execute(
        sa.text(
            """
            INSERT INTO user_limits (
                id, user_id, max_tags, max_seller_aliases, max_product_aliases,
                max_receipts, max_transactions, max_receipt_items, max_import_rows
            )
            SELECT id, id, 25, 100, 100, 10000, 50000, 500, 5000
            FROM users
            ON CONFLICT (user_id) DO NOTHING
            """,
        ),
    )


def downgrade() -> None:
    op.drop_table("user_limits")
