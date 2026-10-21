from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.database import DATABASE_URL, get_db
from src.core.enums.user_status import UserStatus
from src.core.security import create_access_token
from src.main import app
from src.models.user import User
from src.repositories.user import UserRepository


async def test_postgres_transaction_http_contract_and_atomic_bulk_ownership():
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    user_id = None

    async def database():
        async with sessions() as session, session.begin():
            yield session

    try:
        async with sessions() as session, session.begin():
            user = await UserRepository(session).create(
                email=f"audit-{uuid4().hex}@example.test", password_hash="test-only",
            )
            user.status = UserStatus.ACTIVE
            user_id = user.id
        app.dependency_overrides[get_db] = database
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers={"Authorization": f"Bearer {create_access_token(user_id)}"},
        ) as client:
            created = await client.post("/api/v1/transactions", json={
                "name": "Audit coffee", "amount": "150.50", "seller_name": "Audit store",
            })
            assert created.status_code == 201
            transaction_id = created.json()["id"]
            stores = await client.get("/api/v1/transactions/stores")
            assert stores.status_code == 200
            assert stores.json()[0]["seller_id"] == created.json()["seller_id"]

            failed = await client.patch("/api/v1/transactions/bulk", json={
                "ids": [transaction_id, str(uuid4())], "patch": {"comment": "must roll back"},
            })
            assert failed.status_code == 404
            page = await client.get("/api/v1/transactions", params={"limit": 1})
            assert page.status_code == 200
            assert page.json()["total"] == 1
            assert page.json()["items"][0]["comment"] is None
            assert page.json()["items"][0]["amount"] == "150.50"
            updated = await client.patch("/api/v1/transactions/bulk", json={
                "ids": [transaction_id], "patch": {"comment": "committed"},
            })
            assert updated.status_code == 200
            assert updated.json() == {"updated": 1}
            refreshed = await client.get("/api/v1/transactions")
            assert refreshed.json()["items"][0]["comment"] == "committed"
    finally:
        app.dependency_overrides.pop(get_db, None)
        if user_id is not None:
            async with sessions() as session, session.begin():
                await session.execute(delete(User).where(User.id == user_id))
        await engine.dispose()
