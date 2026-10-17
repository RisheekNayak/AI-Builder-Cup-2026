import pytest


def test_reset_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("ENABLE_DEMO_RESET", raising=False)
    assert client.post("/api/demo/reset").status_code == 404


@pytest.mark.parametrize("configured,provided", [("", "anything"), ("secret", None), ("secret", "wrong")])
def test_reset_rejects_unauthorized_without_mutation(client, monkeypatch, configured, provided):
    from unittest.mock import patch
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
    monkeypatch.setenv("DEMO_RESET_TOKEN", configured)
    headers = {"X-Demo-Reset-Token": provided} if provided else {}
    with patch("backend.routers.workspace.seed.reset_and_seed") as reset:
        assert client.post("/api/demo/reset", headers=headers).status_code == 403
        reset.assert_not_called()


def test_reset_accepts_explicitly_enabled_valid_token(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
    monkeypatch.setenv("DEMO_RESET_TOKEN", "test-only-token")
    with patch("backend.routers.workspace.seed.reset_and_seed") as reset:
        response = client.post("/api/demo/reset", headers={"X-Demo-Reset-Token": "test-only-token"})
        assert response.status_code == 200
        reset.assert_called_once()
