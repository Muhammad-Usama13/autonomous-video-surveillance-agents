"""
core/database.py – SQLAlchemy async database setup + ORM models
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


# ─── ORM Models ──────────────────────────────────────────────────────────────

class IncidentModel(Base):
    __tablename__ = "incidents"

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(String, index=True)
    timestamp   = Column(String)           # video timestamp (HH:MM:SS)
    event_type  = Column(String)           # e.g. "crowd_panic"
    severity    = Column(String)           # low / medium / high / critical
    confidence  = Column(Float)
    description = Column(Text)
    frame_path  = Column(String, nullable=True)
    clip_path   = Column(String, nullable=True)
    alert_sent  = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


class SessionModel(Base):
    __tablename__ = "sessions"

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(String, unique=True, index=True)
    video_name  = Column(String)
    status      = Column(String, default="processing")   # processing / done / error
    total_frames= Column(Integer, default=0)
    processed   = Column(Integer, default=0)
    incidents   = Column(Integer, default=0)
    started_at  = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
