"""transactions.comment: необязательный комментарий пользователя.

Комментарий к транзакции — произвольный текст пользователя (например,
причина покупки, пометка «подарок», «для работы»). По умолчанию NULL
(пустой), поле необязательное; ни на какую логику не влияет.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'transactions',
        sa.Column('comment', sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('transactions', 'comment')
