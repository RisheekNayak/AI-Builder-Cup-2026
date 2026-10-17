import copy
import json
import pytest
from infra.import_firestore_demo import import_demo
from backend.tests.test_firestore_state import MemoryState
from backend.services.storage import LocalStorage


def snapshot_api(client):
    paths = {'company': '/api/company/', 'masters': '/api/orders/masters',
             'orders': '/api/orders/?status=all', 'receivables': '/api/receivables/summary',
             'stock': '/api/stock', 'gst': '/api/gst', 'tasks': '/api/tasks?status=all',
             'shipments': '/api/upload/shipments'}
    result = {key: client.get(path).json() for key, path in paths.items()}
    result['statements'] = [client.get(f"/api/receivables/customers/{c['id']}").json() for c in result['masters']['customers']]
    result['order_details'] = [client.get(f"/api/orders/{o['id']}").json() for o in result['orders']['orders']]
    result['documents'] = []
    return result


def test_import_preserves_modified_demo_and_refuses_overwrite(client, tmp_path):
    from backend import db
    from backend.services import receivables
    with db.SessionLocal() as session:
        receivables.record_payment(session, 1, 1234, reference='preserve this payment')
    assert client.post('/api/tasks', json={'title': 'Preserve migration task'}).status_code == 200
    snapshot = snapshot_api(client)
    (tmp_path / 'snapshot.json').write_text(json.dumps(snapshot))
    store = MemoryState()
    objects = LocalStorage(str(tmp_path / 'objects'))
    import_demo(tmp_path, store, objects)
    before = copy.deepcopy(store.payloads)
    assert 'preserve this payment' in store.payloads['payments']
    assert 'Preserve migration task' in store.payloads['tasks']
    with pytest.raises(RuntimeError, match='already contains'):
        import_demo(tmp_path, store, objects)
    assert store.payloads == before


def test_differing_existing_profile_aborts_before_database_write(client, tmp_path):
    snapshot = snapshot_api(client)
    snapshot['company'] = {'company_name': 'Preserve'}
    (tmp_path / 'snapshot.json').write_text(json.dumps(snapshot))
    store = MemoryState()
    objects = LocalStorage(str(tmp_path / 'objects'))
    objects.write('data/company-profile.json', b'different')
    with pytest.raises(RuntimeError, match='differs'):
        import_demo(tmp_path, store, objects)
    assert store.version == 0
