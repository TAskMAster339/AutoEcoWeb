import asyncio

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from src.api.v1.admin import router as admin_router
from src.api.v1.auto_tagging import router as auto_tagging_router
from src.api.v1.aliases import router as aliases_router
from src.api.v1.analytics import router as analytics_router
from src.api.v1.auth import router as auth_router
from src.api.v1.feedback import router as feedback_router
from src.api.v1.import_export import router as import_export_router
from src.api.v1.limits import router as limits_router
from src.api.v1.receipts import router as receipts_router
from src.api.v1.sellers import router as sellers_router
from src.api.v1.tags import router as tags_router
from src.api.v1.transactions import router as transactions_router
from src.core.config import settings
from src.core.csrf import CookieCSRFMiddleware
from src.core.database import engine

app = FastAPI(title=settings.app_name)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(CookieCSRFMiddleware, allowed_origins=settings.allowed_origins)

app.include_router(auth_router)
app.include_router(auto_tagging_router)
app.include_router(admin_router)
app.include_router(receipts_router)
app.include_router(sellers_router)
app.include_router(transactions_router)
app.include_router(analytics_router)
app.include_router(tags_router)
app.include_router(aliases_router)
app.include_router(import_export_router)
app.include_router(limits_router)
app.include_router(feedback_router)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "status": "running",
    }


async def _database_is_ready() -> bool:
    try:
        async with asyncio.timeout(2):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except (TimeoutError, OSError, SQLAlchemyError):
        return False
    return True


@app.get("/health/live")
async def liveness():
    return {
        "status": "ok",
    }


@app.get("/health/ready")
async def readiness():
    if not await _database_is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        )
    return {"status": "ok"}


@app.get("/health", include_in_schema=False)
async def health():
    """Backward-compatible readiness endpoint for existing monitors."""
    return await readiness()
