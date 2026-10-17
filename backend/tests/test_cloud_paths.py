import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock


def test_live_search_parses_real_sdk_response_without_falling_back(monkeypatch):
    from google.cloud import discoveryengine_v1 as discoveryengine
    from backend.services import vertex_search
    monkeypatch.setenv('DEMO_MODE', 'false')
    monkeypatch.setenv('GCP_PROJECT_ID', 'test-project')
    monkeypatch.setenv('GCP_DATASTORE_ID', 'test-datastore')
    result = discoveryengine.SearchResponse.SearchResult(document=discoveryengine.Document(
        id='policy', derived_struct_data={'snippets': [{'snippet': 'Origin evidence required'}], 'link': 'https://example.com/policy'}))
    client = Mock()
    client.search.return_value = SimpleNamespace(results=[result])
    client.serving_config_path.return_value = 'test-serving-config'
    monkeypatch.setattr(discoveryengine, 'SearchServiceClient', lambda: client)
    fallback = Mock(side_effect=AssertionError('Live search unexpectedly fell back'))
    monkeypatch.setattr(vertex_search, 'local_search', fallback)
    results = asyncio.run(vertex_search.search('origin evidence'))
    assert results[0]['content'] == 'Origin evidence required'
    assert results[0]['source'] == 'https://example.com/policy'
    assert results[0]['relevance_score'] == 1.0
    fallback.assert_not_called()


def test_gemini_provider_reports_actual_client_selection(monkeypatch):
    from backend.services import llm
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.delenv('GOOGLE_API_KEY', raising=False)
    assert llm.provider() == 'vertex_ai'
    monkeypatch.setenv('GOOGLE_API_KEY', 'test-only')
    assert llm.provider() == 'developer_api'
    monkeypatch.setenv('ASSISTANT_MODE', 'offline')
    assert llm.status()['available'] is False
    assert llm.status()['mode'] == 'offline'


def test_gemini_success_logged_without_prompt_or_secret(monkeypatch, caplog):
    from backend.services import llm
    client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=AsyncMock(return_value='answer'))))
    monkeypatch.setattr(llm, '_client', lambda: client)
    monkeypatch.setattr(llm, '_disabled_until', 0)
    monkeypatch.setenv('ASSISTANT_MODE', 'auto')
    monkeypatch.setenv('GEMINI_API_KEY', 'private-test-key')
    with caplog.at_level('INFO'):
        assert asyncio.run(llm.generate('private customer prompt')) == 'answer'
    assert 'provider=developer_api' in caplog.text
    assert 'outcome=success' in caplog.text
    assert 'private customer prompt' not in caplog.text
    assert 'private-test-key' not in caplog.text


def test_slow_search_does_not_block_event_loop(monkeypatch):
    import threading
    from backend.services import vertex_search
    started = threading.Event()
    release = threading.Event()

    def slow_search(*args):
        started.set()
        assert release.wait(2)
        return []

    monkeypatch.setattr(vertex_search, '_search', slow_search)

    async def scenario():
        task = asyncio.create_task(vertex_search.search('synthetic question'))
        try:
            for _ in range(100):
                if started.is_set():
                    break
                await asyncio.sleep(.001)
            assert started.is_set()
            assert not task.done()
        finally:
            release.set()
            await task

    asyncio.run(scenario())
