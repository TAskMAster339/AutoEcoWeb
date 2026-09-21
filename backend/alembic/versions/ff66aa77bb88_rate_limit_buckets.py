"""Add shared authentication rate-limit buckets.

Revision ID: ff66aa77bb88
Revises: ee55ff66aa77
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "ff66aa77bb88"
down_revision: str | Sequence[str] | None = "ee55ff66aa77"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_buckets",
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("key_hash"),
    )


def downgrade() -> None:
    op.drop_table("rate_limit_buckets")
