import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="shipsure-test-")
os.environ["SHIPSURE_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ASSISTANT_MODE"] = "offline"
os.environ["DEMO_MODE"] = "true"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from backend.main import app
    with TestClient(app) as c:
        c.post("/api/demo/reset")
        yield c
