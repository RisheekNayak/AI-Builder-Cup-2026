"""Read-only comparison of a candidate API against a preserved snapshot."""
import argparse
import json
from pathlib import Path
import httpx


def verify(base_url, snapshot):
    paths = {'company': '/api/company/', 'masters': '/api/orders/masters',
             'orders': '/api/orders/?status=all', 'receivables': '/api/receivables/summary',
             'stock': '/api/stock', 'gst': '/api/gst', 'tasks': '/api/tasks?status=all',
             'shipments': '/api/upload/shipments'}
    with httpx.Client(base_url=base_url, timeout=60) as client:
        def get(path):
            response = client.get(path)
            response.raise_for_status()
            return response.json()
        for section, path in paths.items():
            actual = get(path)
            if actual != snapshot[section]:
                raise RuntimeError(f'{section} differs from preserved snapshot; do not switch traffic')
        for order in snapshot['order_details']:
            assert get(f"/api/orders/{order['id']}") == order, 'Order differs'
        for statement in snapshot['statements']:
            assert get(f"/api/receivables/customers/{statement['customer']['id']}") == statement, 'Statement differs'
    print('Verified profile, masters, orders/details, receivables/statements, stock, GST, tasks and shipments against backup.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    args = parser.parse_args()
    verify(args.base_url, json.loads(args.snapshot.read_text()))
