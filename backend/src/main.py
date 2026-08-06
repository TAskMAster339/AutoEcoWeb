from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.v1.auth import router as auth_router
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
