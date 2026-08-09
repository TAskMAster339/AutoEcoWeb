from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.v1.admin import router as admin_router
from src.api.v1.aliases import router as aliases_router
from src.api.v1.analytics import router as analytics_router
from src.api.v1.auth import router as auth_router
from src.api.v1.import_export import router as import_export_router
from src.api.v1.receipts import router as receipts_router
from src.api.v1.tags import router as tags_router
from src.api.v1.transactions import router as transactions_router
from src.core.config import settings

app = FastAPI(title=settings.app_name)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(receipts_router)
app.include_router(transactions_router)
app.include_router(analytics_router)
app.include_router(tags_router)
app.include_router(aliases_router)
app.include_router(import_export_router)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "status": "running",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
    }
