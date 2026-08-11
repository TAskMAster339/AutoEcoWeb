from enum import Enum


class UserStatus(str, Enum):
    PENDING = "pending"
    # Почта подтверждена, но аккаунт ещё не активирован администратором.
    # Для входа ничем не отличается от неактивного: 403 до активации.
    VERIFIED = "verified"
    ACTIVE = "active"
    BLOCKED = "blocked"
