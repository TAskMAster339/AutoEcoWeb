"""add personal auto-tagging settings and model metadata

Revision ID: cc33dd44ee55
Revises: bb22cc33dd44
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cc33dd44ee55"
down_revision: str | None = "bb22cc33dd44"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "auto_tagging_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "auto_tagging_training_revision",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "transactions",
        sa.Column("tag_source", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("tag_confidence", sa.Float(), nullable=True),
    )
    op.execute("UPDATE transactions SET tag_source = 'manual' WHERE tag_id IS NOT NULL")
    op.create_index(
        "ix_transactions_user_tag_source_updated",
        "transactions",
        ["user_id", "tag_source", "updated_at"],
    )
    op.create_check_constraint(
        "ck_transactions_tag_source",
        "transactions",
        "tag_source IS NULL OR tag_source IN ('manual', 'auto')",
    )
    op.create_check_constraint(
        "ck_transactions_tag_confidence",
        "transactions",
        "tag_confidence IS NULL OR (tag_confidence >= 0 AND tag_confidence <= 1)",
    )
    op.create_table(
        "auto_tagging_model_states",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False),
        sa.Column("trained_revision", sa.Integer(), nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("training_examples", sa.Integer(), nullable=False),
        sa.Column("validation_examples", sa.Integer(), nullable=False),
        sa.Column("distinct_tags", sa.Integer(), nullable=False),
        sa.Column("supported_tags", sa.Integer(), nullable=False),
        sa.Column("precision", sa.Float(), nullable=True),
        sa.Column("coverage", sa.Float(), nullable=True),
        sa.Column("macro_f1", sa.Float(), nullable=True),
        sa.Column("store_baseline_precision", sa.Float(), nullable=True),
        sa.Column("threshold", sa.Float(), nullable=True),
        sa.Column("per_tag_metrics", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_auto_tagging_model_states_user_id",
        "auto_tagging_model_states",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_auto_tagging_model_states_user_id",
        table_name="auto_tagging_model_states",
    )
    op.drop_table("auto_tagging_model_states")
    op.drop_constraint(
        "ck_transactions_tag_confidence",
        "transactions",
        type_="check",
    )
    op.drop_constraint("ck_transactions_tag_source", "transactions", type_="check")
    op.drop_index("ix_transactions_user_tag_source_updated", table_name="transactions")
    op.drop_column("transactions", "tag_confidence")
    op.drop_column("transactions", "tag_source")
    op.drop_column("users", "auto_tagging_training_revision")
    op.drop_column("users", "auto_tagging_enabled")
