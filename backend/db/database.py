from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..config import settings

DATABASE_URL = (
    f"postgresql+psycopg2://{settings.postgres_user}: "
    f"{settings.postgres_password}@{settings.postgres_host}: "
    f"{settings.potgres_port}/{settings.postgres_db_name}"
)


engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=True,
    future=True,
)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
