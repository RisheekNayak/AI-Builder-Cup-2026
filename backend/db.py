import os
from datetime import date
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_URL = f"sqlite:///{PROJECT_ROOT / 'backend' / 'data' / 'shipsure.db'}"
DEMO_ORG = "demo"


class Base(DeclarativeBase):
    pass


engine = None
SessionLocal = None


def configure(url: str | None = None):
    """(Re)bind the engine. Tests call this with a temporary database URL."""
    global engine, SessionLocal
    url = url or os.environ.get("SHIPSURE_DATABASE_URL") or DEFAULT_URL
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)
    SessionLocal = sessionmaker(engine, expire_on_commit=False)


configure()


def init_db():
    import backend.models.business  # noqa: F401  (registers tables)
    Base.metadata.create_all(engine)


def get_db():
    with SessionLocal() as session:
        yield session


def today() -> date:
    override = os.environ.get("SHIPSURE_TODAY")
    return date.fromisoformat(override) if override else date.today()
