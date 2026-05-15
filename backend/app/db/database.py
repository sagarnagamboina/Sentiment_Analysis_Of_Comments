"""
database.py — MySQL connection pool using SQLAlchemy async engine.
All tables are created on startup via create_all().
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# ── Connection string ─────────────────────────────────────────────────────────
# Set via environment variable or edit the defaults below.
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_NAME     = os.getenv("DB_NAME",     "sentiment_db")
DB_USER     = os.getenv("DB_USER",     "sentiment_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Sagar725")

DATABASE_URL = (
    f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async session and commits/rollbacks."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Called once on startup to create all tables."""
    async with engine.begin() as conn:
        from app.models import dataset  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
