"""Create clearly labelled synthetic smoke records, then check after a new revision.
No payments, dispatches, stock or company fields are changed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import httpx
from infra.verify_preserved_demo import verify


def smoke(base_url, snapshot, state_file, phase):
    with httpx.Client(base_url=base_url, timeout=180) as client:
        def request(method, path, **kwargs):
            result = client.request(method, path, **kwargs)
            result.raise_for_status()
            return result
        if phase == 'create':
            verify(base_url, snapshot)
            task = request('POST', '/api/tasks', json={'title': 'Persistence verification — synthetic demo check',
                'detail': 'Created during the Firestore migration; safe demo verification record.'}).json()
            shipment = request('POST', '/api/upload/sample/fta-eligible').json()
            assert shipment['status'] == 'complete', shipment
            sid = shipment['shipment_id']
            forms = request('POST', f'/api/forms/{sid}/generate').json()
            assert any(f['status'] == 'generated' for f in forms['forms'])
            pdf = request('GET', f'/api/forms/{sid}/forms/shipping_bill/download').content
            assert pdf.startswith(b'%PDF')
            state_file.write_text(json.dumps({'task': task, 'shipment_id': sid,
                'pdf_sha256': hashlib.sha256(pdf).hexdigest()}))
            print('PASS: task, synthetic invoice and PDF saved through candidate API. Ready for revision recreation.')
        else:
            state = json.loads(state_file.read_text())
            tasks = request('GET', '/api/tasks?status=all').json()['tasks']
            assert state['task'] in tasks, 'Task did not persist'
            for task in snapshot['tasks']['tasks']:
                assert task in tasks, 'Original task changed'
            sid = state['shipment_id']
            assert request('GET', f'/api/upload/shipments/{sid}').json()['status'] == 'complete'
            pdf = request('GET', f'/api/forms/{sid}/forms/shipping_bill/download').content
            assert hashlib.sha256(pdf).hexdigest() == state['pdf_sha256'], 'PDF changed'
            for key, path in {'company':'/api/company/', 'orders':'/api/orders/?status=all',
                              'receivables':'/api/receivables/summary', 'stock':'/api/stock', 'gst':'/api/gst'}.items():
                assert request('GET', path).json() == snapshot[key], f'{key} changed'
            # Keep an auditable completed synthetic task; do not delete records.
            request('PATCH', f"/api/tasks/{state['task']['id']}", json={'status':'done'})
            print('PASS: task, invoice and identical PDF survived a new revision; original business data/profile unchanged.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--phase', choices=['create', 'verify'], required=True)
    args = parser.parse_args()
    smoke(args.base_url, json.loads(args.snapshot.read_text()), args.state, args.phase)
