"""aliases.scope: область применения алиаса (магазины / товары).

Алиасы теперь бывают двух типов: 'seller' (нормализация названий
магазинов — как раньше) и 'product' (нормализация названий позиций
транзакций). Существующие алиасы получают scope='seller'.

Unique-пара расширяется скоупом (одна и та же пара шаблон→алиас может
существовать отдельно для магазинов и для товаров), индекс списка —
тоже (пагинация по скоупу).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'aliases',
        sa.Column(
            'scope',
            sa.String(length=16),
            server_default='seller',
            nullable=False,
        ),
    )
    op.drop_constraint('uq_aliases_user_pair', 'aliases', type_='unique')
    op.create_unique_constraint(
        'uq_aliases_user_scope_pair',
        'aliases',
        ['user_id', 'scope', 'original_name', 'alias_name'],
    )
    op.drop_index('ix_aliases_user_created', table_name='aliases')
    op.create_index(
        'ix_aliases_user_scope_created',
        'aliases',
        ['user_id', 'scope', 'created_at', 'id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_aliases_user_scope_created', table_name='aliases')
    op.create_index(
        'ix_aliases_user_created',
        'aliases',
        ['user_id', 'created_at', 'id'],
        unique=False,
    )
    op.drop_constraint('uq_aliases_user_scope_pair', 'aliases', type_='unique')
    op.create_unique_constraint(
        'uq_aliases_user_pair',
        'aliases',
        ['user_id', 'original_name', 'alias_name'],
    )
    op.drop_column('aliases', 'scope')
