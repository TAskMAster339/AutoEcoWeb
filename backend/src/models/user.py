from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.user_limits import UserLimits


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

    # Персональный токен proverkacheka.com; используется при автозагрузке
    proverkacheka_token: Mapped[str | None] = mapped_column(
        String(256),
        nullable=True,
    )

    auto_tagging_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    auto_tagging_training_revision: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    limits: Mapped["UserLimits"] = relationship(
        "UserLimits",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="joined",
        uselist=False,
    )
