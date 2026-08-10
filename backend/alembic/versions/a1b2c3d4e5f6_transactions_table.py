"""receipt_items → transactions: транзакция — минимальная единица учёта.

- таблица переименована: receipt_items → transactions
- product_name → name, total_price → amount
- добавлены user_id / datetime / operation_type (бэкафилл из receipts)
- receipt_id / position / quantity / unit / price стали nullable
  (ручная транзакция может существовать без чека)

Revision ID: a1b2c3d4e5f6
Revises: 44807a90ac0c
Create Date: 2026-08-08

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "44807a90ac0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table("receipt_items", "transactions")

    op.alter_column("transactions", "product_name", new_column_name="name")
    op.alter_column("transactions", "total_price", new_column_name="amount")

    # Новые колонки (nullable → бэкафилл → NOT NULL)
    op.add_column("transactions", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.add_column(
        "transactions",
        sa.Column("datetime", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("operation_type", sa.SmallInteger(), nullable=True),
    )

    op.execute(
        """
        UPDATE transactions t
        SET user_id = r.user_id,
            datetime = r.datetime,
            operation_type = r.operation_type
        FROM receipts r
        WHERE t.receipt_id = r.id
        """,
    )
    op.alter_column("transactions", "user_id", nullable=False)
    op.alter_column("transactions", "datetime", nullable=False)
    op.alter_column("transactions", "operation_type", nullable=False)

    # Ручные транзакции: чек/позиция/кол-во/цена необязательны
    op.alter_column("transactions", "receipt_id", nullable=True)
    op.alter_column("transactions", "position", nullable=True)
    op.alter_column("transactions", "quantity", nullable=True)
    op.alter_column("transactions", "unit", nullable=True)
    op.alter_column("transactions", "price", nullable=True)

    # Индексы под новое имя
    op.drop_index("ix_receipt_items_receipt", table_name="transactions")
    op.drop_index("ix_receipt_items_tag", table_name="transactions")
    op.create_index("ix_transactions_receipt", "transactions", ["receipt_id"])
    op.create_index("ix_transactions_tag", "transactions", ["tag_id"])
    op.create_index(
        "ix_transactions_user_created",
        "transactions",
        ["user_id", "created_at", "id"],
    )

    # FK: владелец + переименование старых ограничений
    op.create_foreign_key(
        "fk_transactions_user_id",
        "transactions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "receipt_items_pkey TO transactions_pkey",
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "receipt_items_receipt_id_fkey TO transactions_receipt_id_fkey",
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "receipt_items_tag_id_fkey TO transactions_tag_id_fkey",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "transactions_tag_id_fkey TO receipt_items_tag_id_fkey",
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "transactions_receipt_id_fkey TO receipt_items_receipt_id_fkey",
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT "
        "transactions_pkey TO receipt_items_pkey",
    )
    op.drop_constraint("fk_transactions_user_id", "transactions", type_="foreignkey")
    op.drop_index("ix_transactions_user_created", table_name="transactions")
    op.drop_index("ix_transactions_tag", table_name="transactions")
    op.drop_index("ix_transactions_receipt", table_name="transactions")
    op.create_index("ix_receipt_items_tag", "transactions", ["tag_id"])
    op.create_index("ix_receipt_items_receipt", "transactions", ["receipt_id"])
    op.alter_column("transactions", "price", nullable=False)
    op.alter_column("transactions", "unit", nullable=False)
    op.alter_column("transactions", "quantity", nullable=False)
    op.alter_column("transactions", "position", nullable=False)
    op.alter_column("transactions", "receipt_id", nullable=False)
    op.alter_column("transactions", "operation_type", nullable=True)
    op.alter_column("transactions", "datetime", nullable=True)
    op.alter_column("transactions", "user_id", nullable=True)
    op.alter_column("transactions", "amount", new_column_name="total_price")
    op.alter_column("transactions", "name", new_column_name="product_name")
    op.rename_table("transactions", "receipt_items")
