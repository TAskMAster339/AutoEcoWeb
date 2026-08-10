"""Extract seller values into the sellers entity.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sellers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("seller_alias_id", sa.Uuid(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["seller_alias_id"],
            ["aliases.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_sellers_user_name"),
    )
    op.create_index("ix_sellers_user_id", "sellers", ["user_id"])
    op.create_index(
        "ix_sellers_user_created",
        "sellers",
        ["user_id", "created_at", "id"],
    )
    op.create_index("ix_sellers_seller_alias_id", "sellers", ["seller_alias_id"])

    op.execute(
        sa.text(
            """
            INSERT INTO sellers (id, user_id, name, normalized_name, seller_alias_id)
            SELECT
                gen_random_uuid(),
                user_id,
                name,
                normalized_name,
                seller_alias_id
            FROM (
                SELECT
                    user_id,
                    seller_name AS name,
                    normalized_seller_name AS normalized_name,
                    seller_name_alias_id AS seller_alias_id,
                    created_at,
                    id
                FROM receipts
                UNION ALL
                SELECT
                    user_id,
                    seller_name AS name,
                    normalized_seller_name AS normalized_name,
                    seller_name_alias_id AS seller_alias_id,
                    created_at,
                    id
                FROM transactions
                WHERE seller_name IS NOT NULL
            ) AS source
            WHERE NOT EXISTS (
                SELECT 1
                FROM (
                    SELECT
                        user_id,
                        seller_name AS name,
                        created_at,
                        id
                    FROM receipts
                    UNION ALL
                    SELECT
                        user_id,
                        seller_name AS name,
                        created_at,
                        id
                    FROM transactions
                    WHERE seller_name IS NOT NULL
                ) AS prior
                WHERE prior.user_id = source.user_id
                  AND prior.name = source.name
                  AND (prior.created_at, prior.id) < (source.created_at, source.id)
            )
            """,
        ),
    )

    op.add_column("receipts", sa.Column("seller_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_receipts_seller_id_sellers",
        "receipts",
        "sellers",
        ["seller_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_receipts_seller_id", "receipts", ["seller_id"])
    op.execute(
        sa.text(
            """
            UPDATE receipts AS r
            SET seller_id = s.id
            FROM sellers AS s
            WHERE s.user_id = r.user_id AND s.name = r.seller_name
            """,
        ),
    )
    op.alter_column("receipts", "seller_id", nullable=False)

    op.add_column("transactions", sa.Column("seller_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_seller_id_sellers",
        "transactions",
        "sellers",
        ["seller_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_transactions_seller_id", "transactions", ["seller_id"])
    op.execute(
        sa.text(
            """
            UPDATE transactions AS t
            SET seller_id = s.id
            FROM sellers AS s
            WHERE t.receipt_id IS NULL
              AND s.user_id = t.user_id
              AND s.name = t.seller_name
            """,
        ),
    )

    op.drop_constraint(
        "fk_receipts_seller_name_alias_id_aliases",
        "receipts",
        type_="foreignkey",
    )
    op.drop_index("ix_receipts_seller_name_alias_id", table_name="receipts")
    op.drop_column("receipts", "seller_name")
    op.drop_column("receipts", "normalized_seller_name")
    op.drop_column("receipts", "seller_name_alias_id")

    op.drop_constraint(
        "fk_transactions_seller_name_alias_id_aliases",
        "transactions",
        type_="foreignkey",
    )
    op.drop_index("ix_transactions_seller_name_alias_id", table_name="transactions")
    op.drop_column("transactions", "seller_name")
    op.drop_column("transactions", "normalized_seller_name")
    op.drop_column("transactions", "seller_name_alias_id")


def downgrade() -> None:
    op.add_column(
        "receipts",
        sa.Column("seller_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "receipts",
        sa.Column("normalized_seller_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "receipts",
        sa.Column("seller_name_alias_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("seller_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("normalized_seller_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("seller_name_alias_id", sa.Uuid(), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE receipts AS r
            SET seller_name = s.name,
                normalized_seller_name = s.normalized_name,
                seller_name_alias_id = s.seller_alias_id
            FROM sellers AS s
            WHERE s.id = r.seller_id
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE transactions AS t
            SET seller_name = s.name,
                normalized_seller_name = s.normalized_name,
                seller_name_alias_id = s.seller_alias_id
            FROM sellers AS s
            WHERE s.id = t.seller_id
            """,
        ),
    )

    op.alter_column("receipts", "seller_name", nullable=False)
    op.alter_column("receipts", "normalized_seller_name", nullable=False)
    op.create_foreign_key(
        "fk_receipts_seller_name_alias_id_aliases",
        "receipts",
        "aliases",
        ["seller_name_alias_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_receipts_seller_name_alias_id",
        "receipts",
        ["seller_name_alias_id"],
    )
    op.create_foreign_key(
        "fk_transactions_seller_name_alias_id_aliases",
        "transactions",
        "aliases",
        ["seller_name_alias_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_transactions_seller_name_alias_id",
        "transactions",
        ["seller_name_alias_id"],
    )

    op.drop_index("ix_receipts_seller_id", table_name="receipts")
    op.drop_constraint("fk_receipts_seller_id_sellers", "receipts", type_="foreignkey")
    op.drop_column("receipts", "seller_id")
    op.drop_index("ix_transactions_seller_id", table_name="transactions")
    op.drop_constraint(
        "fk_transactions_seller_id_sellers",
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "seller_id")
    op.drop_index("ix_sellers_seller_alias_id", table_name="sellers")
    op.drop_index("ix_sellers_user_created", table_name="sellers")
    op.drop_index("ix_sellers_user_id", table_name="sellers")
    op.drop_table("sellers")
