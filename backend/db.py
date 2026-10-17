import os
from datetime import date
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_URL = f"sqlite:///{PROJECT_ROOT / 'backend' / 'data' / 'shipsure.db'}"
DEMO_ORG = "demo"


class Base(DeclarativeBase):
    pass


engine = None
SessionLocal = None


_connector = None


def configure(url: str | None = None):
    """Use local SQLite, a PostgreSQL URL, or Cloud SQL with automatic IAM auth."""
    global engine, SessionLocal, _connector
    if engine is not None:
        engine.dispose()
    if _connector is not None:
        _connector.close()
        _connector = None
    if url is None and os.getenv("SHIPSURE_DATABASE_BACKEND", "sqlite") == "firestore":
        from backend.services.firestore_state import FirestoreSession
        engine = create_engine("sqlite://")  # metadata only; never authoritative storage
        SessionLocal = FirestoreSession
        return
    instance = os.getenv("SHIPSURE_CLOUD_SQL_INSTANCE") if url is None else None
    if instance:
        from google.cloud.sql.connector import Connector
        user = os.environ["SHIPSURE_DB_USER"]
        database = os.environ["SHIPSURE_DB_NAME"]
        connector = Connector(refresh_strategy="LAZY")
        _connector = connector
        engine = create_engine(
            "postgresql+pg8000://",
            creator=lambda: connector.connect(instance, "pg8000", user=user, db=database,
                                               enable_iam_auth=True, timeout=30),
            pool_size=3, max_overflow=2, pool_timeout=30, pool_recycle=1800, pool_pre_ping=True,
        )
    else:
        url = url or os.getenv("SHIPSURE_DATABASE_URL") or DEFAULT_URL
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
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


def bootstrap():
    """Serialize initial schema creation and demo seeding across PostgreSQL instances."""
    from backend.services.seed import seed_if_empty
    from sqlalchemy.orm import Session
    import backend.models.business  # noqa: F401
    if os.getenv("SHIPSURE_DATABASE_BACKEND", "sqlite") == "firestore":
        from backend.services.firestore_state import get_state_store
        version, _ = get_state_store().load()
        if not version:
            raise RuntimeError("Firestore is empty. Import the preserved demo before starting the service.")
        return
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("SELECT pg_advisory_xact_lock(73481925)"))
            Base.metadata.create_all(connection)
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                seed_if_empty(session)
    else:
        init_db()
        with SessionLocal() as session:
            seed_if_empty(session)
