from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.cookies import ACCESS_COOKIE
from src.core.database import get_db
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.core.security import decode_access_token
from src.models.user import User
from src.repositories.alias import AliasRepository
from src.repositories.email_code import EmailCodeRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.refresh_token import RefreshTokenRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.services.aliases import AliasService
from src.services.import_export import ImportExportService
from src.services.email import EmailService
from src.services.proverkacheka import ProverkachekaClient
from src.services.sellers import SellerService
from src.services.transaction import TransactionService

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_user_repo(session: DBSession) -> UserRepository:
    return UserRepository(session)


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]


async def get_refresh_repo(session: DBSession) -> RefreshTokenRepository:
    return RefreshTokenRepository(session)


RefreshRepo = Annotated[RefreshTokenRepository, Depends(get_refresh_repo)]


async def get_email_code_repo(session: DBSession) -> EmailCodeRepository:
    return EmailCodeRepository(session)


EmailCodeRepo = Annotated[EmailCodeRepository, Depends(get_email_code_repo)]


def get_email_service() -> EmailService:
    return EmailService()


EmailSvc = Annotated[EmailService, Depends(get_email_service)]


async def get_receipt_repo(session: DBSession) -> ReceiptRepository:
    return ReceiptRepository(session)


ReceiptRepo = Annotated[ReceiptRepository, Depends(get_receipt_repo)]


async def get_transaction_repo(session: DBSession) -> TransactionRepository:
    return TransactionRepository(session)


TransactionRepo = Annotated[TransactionRepository, Depends(get_transaction_repo)]


async def get_seller_service(session: DBSession) -> SellerService:
    from src.repositories.seller import SellerRepository

    return SellerService(SellerRepository(session), AliasRepository(session))


SellerSvc = Annotated[SellerService, Depends(get_seller_service)]


async def get_transaction_service(
    session: DBSession,
    receipt_repo: ReceiptRepo,
    seller_service: SellerSvc,
) -> TransactionService:
    return TransactionService(
        TransactionRepository(session),
        receipt_repo,
        TagRepository(session),
        AliasRepository(session),
        seller_service,
    )


TransactionSvc = Annotated[TransactionService, Depends(get_transaction_service)]


async def get_tag_repo(session: DBSession) -> TagRepository:
    return TagRepository(session)


TagRepo = Annotated[TagRepository, Depends(get_tag_repo)]


async def get_import_export_service(
    session: DBSession,
    seller_service: SellerSvc,
) -> ImportExportService:
    return ImportExportService(
        session,
        TransactionRepository(session),
        TagRepository(session),
        AliasRepository(session),
        seller_service,
    )


ImportExportSvc = Annotated[ImportExportService, Depends(get_import_export_service)]


async def get_alias_repo(session: DBSession) -> AliasRepository:
    return AliasRepository(session)


AliasRepo = Annotated[AliasRepository, Depends(get_alias_repo)]


async def get_alias_service(
    session: DBSession,
    seller_service: SellerSvc,
) -> AliasService:
    """Алиасы + применение к существующим записям (чеки и транзакции)."""
    return AliasService(
        AliasRepository(session),
        seller_service,
        TransactionRepository(session),
        ReceiptRepository(session),
    )


AliasSvc = Annotated[AliasService, Depends(get_alias_service)]


def get_proverkacheka_client() -> ProverkachekaClient:
    return ProverkachekaClient()


Proverkacheka = Annotated[ProverkachekaClient, Depends(get_proverkacheka_client)]


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,  # нет заголовка → None (не 401), куку читаем сами
)


async def get_current_user(
    request: Request,
    repo: UserRepo,
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить credentials",  # noqa: RUF001
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1) Браузер: кука autoeco_access приходит сама, JS её не касается
    token = request.cookies.get(ACCESS_COOKIE)

    # 2) Фолбэк: Swagger и API-клиенты шлют Authorization: Bearer <token>
    if token is None:
        token = bearer_token

    if token is None:
        raise credentials_error

    try:
        user_id = decode_access_token(token)
    except (JWTError, ValueError):
        raise credentials_error  # noqa: B904

    user = await repo.get(user_id)
    if user is None:
        raise credentials_error

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт неактивен или заблокирован",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора",
        )
    return current_user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]
