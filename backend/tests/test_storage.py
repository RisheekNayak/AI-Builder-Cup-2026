from pathlib import Path
from unittest.mock import Mock
import pytest
from google.api_core.exceptions import Forbidden, NotFound, PreconditionFailed
from backend.services.storage import GCSStorage, LocalStorage


@pytest.mark.parametrize('key', ['../escape', '/absolute', 'data/../../escape', 'data\\escape'])
def test_storage_rejects_path_escape(tmp_path, key):
    with pytest.raises(ValueError):
        LocalStorage(str(tmp_path)).write(key, b'bad')


def test_local_store_survives_new_instance_and_create_never_overwrites(tmp_path):
    first = LocalStorage(str(tmp_path))
    first.write('data/profile.json', b'original')
    second = LocalStorage(str(tmp_path))
    second.create('data/profile.json', b'wrong')
    assert second.read('data/profile.json') == b'original'
    assert second.read('missing') is None


def cloud_store():
    store = object.__new__(GCSStorage)
    store.bucket = Mock()
    store.prefix = 'shipsure/demo'
    return store


def test_gcs_private_objects_roundtrip_and_namespace():
    store = cloud_store()
    store.write('data/profile.json', b'profile', 'application/json')
    store.bucket.blob.assert_called_with('shipsure/demo/data/profile.json')
    store.bucket.blob.return_value.upload_from_string.assert_called_once_with(
        b'profile', content_type='application/json', timeout=30)
    store.bucket.blob.return_value.download_as_bytes.return_value = b'profile'
    assert store.read('data/profile.json') == b'profile'


def test_gcs_missing_is_distinct_from_access_denied():
    store = cloud_store()
    store.bucket.blob.return_value.download_as_bytes.side_effect = NotFound('missing')
    assert store.read('missing') is None
    store.bucket.blob.return_value.download_as_bytes.side_effect = Forbidden('denied')
    with pytest.raises(Forbidden):
        store.read('data/profile.json')


def test_gcs_initialize_is_create_only():
    store = cloud_store()
    store.bucket.blob.return_value.upload_from_string.side_effect = PreconditionFailed('exists')
    store.create('profile.json', b'seed', 'application/json')
    assert store.bucket.blob.return_value.upload_from_string.call_args.kwargs['if_generation_match'] == 0


def test_profile_storage_outage_returns_503_not_empty_onboarding(client, monkeypatch):
    from backend.routers import company
    store = Mock()
    store.read.side_effect = Forbidden('denied')
    monkeypatch.setattr(company, 'get_storage', lambda: store)
    response = client.get('/api/company/')
    assert response.status_code == 503
    assert 'storage' in response.json()['detail']


def test_upload_storage_failure_marks_record_and_does_not_analyze(client, monkeypatch):
    from backend.routers import upload
    store = Mock()
    store.write.side_effect = Forbidden('denied')
    monkeypatch.setattr(upload, 'get_storage', lambda: store)
    analyze = Mock()
    monkeypatch.setattr(upload, 'process_document', analyze)
    response = client.post('/api/upload/', files={'file': ('invoice.json', b'{}', 'application/json')})
    assert response.status_code == 503
    analyze.assert_not_called()
    records = client.get('/api/upload/shipments').json()['shipments']
    assert records[0]['status'] == 'error'


def test_generated_pdf_survives_new_storage_instance_and_is_invalidated_after_edit(client, monkeypatch, tmp_path):
    from backend.routers import forms
    monkeypatch.setattr(forms, 'get_storage', lambda: LocalStorage(str(tmp_path)))
    sid = client.post('/api/upload/sample/fta-eligible').json()['shipment_id']
    assert client.post(f'/api/forms/{sid}/generate').status_code == 200
    pdf = client.get(f'/api/forms/{sid}/forms/coo/download')
    assert pdf.content.startswith(b'%PDF')
    data = client.get(f'/api/extraction/{sid}').json()['extracted_data']
    data['invoice_number'] = 'REVISED'
    assert client.patch(f'/api/extraction/{sid}', json=data).status_code == 200
    assert client.get(f'/api/forms/{sid}/forms/coo/download').status_code == 404


def test_database_reopen_retains_records_and_does_not_reseed(tmp_path):
    from backend import db
    from backend.models.business import Task
    from sqlalchemy import select, func
    previous = str(db.engine.url)
    target = f'sqlite:///{tmp_path}/persistent.db'
    try:
        db.configure(target)
        db.bootstrap()
        with db.SessionLocal() as session:
            session.add(Task(title='restart sentinel'))
            session.commit()
            before = session.scalar(select(func.count()).select_from(Task))
        db.configure(target)
        db.bootstrap()
        with db.SessionLocal() as session:
            assert session.scalar(select(func.count()).select_from(Task)) == before
            assert session.scalar(select(Task).where(Task.title == 'restart sentinel'))
    finally:
        db.configure(previous)


def test_cloud_sql_configuration_uses_iam_and_bounded_pool(monkeypatch):
    from backend import db
    from google.cloud.sql import connector as connector_module
    previous = str(db.engine.url)
    fake = Mock()
    fake_engine = Mock()
    create = Mock(return_value=fake_engine)
    monkeypatch.setenv('SHIPSURE_CLOUD_SQL_INSTANCE', 'project:us-central1:shipsure-db')
    monkeypatch.setenv('SHIPSURE_DB_USER', 'runtime@project.iam')
    monkeypatch.setenv('SHIPSURE_DB_NAME', 'shipsure')
    with monkeypatch.context() as scoped:
        scoped.setattr(connector_module, 'Connector', Mock(return_value=fake))
        scoped.setattr(db, 'create_engine', create)
        db.configure()
        kwargs = create.call_args.kwargs
        kwargs['creator']()
        fake.connect.assert_called_once_with('project:us-central1:shipsure-db', 'pg8000',
                                            user='runtime@project.iam', db='shipsure',
                                            enable_iam_auth=True, timeout=30)
        assert kwargs['pool_size'] == 3 and kwargs['max_overflow'] == 2
        assert kwargs['pool_pre_ping'] is True
    db.configure(previous)


def test_durable_mode_refuses_sqlite(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app
    monkeypatch.setenv('SHIPSURE_REQUIRE_DURABLE_STORAGE', 'true')
    with pytest.raises(RuntimeError, match='Durable mode requires'):
        with TestClient(app):
            pass


def test_demo_reset_cannot_drop_postgres_tables():
    from backend.routers.workspace import reset_demo
    from fastapi import HTTPException
    session = Mock()
    session.get_bind.return_value.dialect.name = 'postgresql'
    with pytest.raises(HTTPException) as error:
        reset_demo(session)
    assert error.value.status_code == 404
    session.close.assert_not_called()
