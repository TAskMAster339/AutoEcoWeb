"""Allow alias matching rules up to 1000 characters.

Revision ID: dd44ee55ff66
Revises: cc33dd44ee55
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "dd44ee55ff66"
down_revision: str | Sequence[str] | None = "cc33dd44ee55"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "aliases",
        "original_name",
        existing_type=sa.String(length=255),
        type_=sa.String(length=1000),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "aliases",
        "original_name",
        existing_type=sa.String(length=1000),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
