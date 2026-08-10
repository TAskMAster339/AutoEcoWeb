import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from src.core.database import Base
from src.models import User  # noqa: F401 — регистрирует модели в metadata
from src.repositories.user import UserRepository


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,  # иначе каждая сессия получит СВОЮ in-memory БД
    )
    async with engine.begin() as conn:
        # FK-каскады (transactions.receipt_id CASCADE и т.п.) — как в postgres
        await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)
    _session = async_sessionmaker(engine, expire_on_commit=False)
    async with _session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
def repo(session):
    return UserRepository(session)


@pytest_asyncio.fixture
async def user(session):
    return await UserRepository(session).create(
        email="fixture-user@example.com",
        password_hash="x" * 60,
    )
