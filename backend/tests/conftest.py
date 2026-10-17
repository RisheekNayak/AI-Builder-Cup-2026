import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="shipsure-test-")
os.environ["SHIPSURE_DATABASE_BACKEND"] = "sqlite"
os.environ["SHIPSURE_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ASSISTANT_MODE"] = "offline"
os.environ["DEMO_MODE"] = "true"
os.environ.pop("SHIPSURE_CLOUD_SQL_INSTANCE", None)
os.environ["SHIPSURE_REQUIRE_DURABLE_STORAGE"] = "false"
os.environ["SHIPSURE_STORAGE_BACKEND"] = "local"
os.environ["SHIPSURE_STORAGE_ROOT"] = f"{_tmp}/objects"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from backend.main import app
    with TestClient(app) as c:
        from backend import db
        from backend.services import seed
        with db.SessionLocal() as session:
            seed.reset_and_seed(session)
        yield c
