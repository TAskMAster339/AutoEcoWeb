"""transactions.seller_name: магазин ручной транзакции.

Раньше продавец существовал только у чека («коробки»), и ручная
транзакция без чека магазина не имела. Теперь у транзакции может
быть собственный seller_name (ручной ввод); у транзакций из чеков
поле остаётся NULL — продавец берётся из чека (left join).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-08

"""  # noqa: RUF002

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "transactions",
        sa.Column("seller_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("transactions", "seller_name")
