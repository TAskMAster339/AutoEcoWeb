from sqlalchemy import Enum, String, Index
from sqlalchemy.orm import Mapped, mapped_column
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.models.base import BaseModel


def _enum_values(enum_cls: type) -> list[str]:
    return [member.value for member in enum_cls]


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_created_at_id", "created_at", "id"),)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=_enum_values),
        default=UserRole.USER,
        nullable=False,
    )

    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, values_callable=_enum_values),
        default=UserStatus.PENDING,
        nullable=False,
    )
