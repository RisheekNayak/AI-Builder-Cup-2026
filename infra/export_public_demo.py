"""Read-only preservation of API-visible demo data and generated PDF bytes.
Does not claim to recover original uploads or unexposed database metadata.
"""
import argparse
import hashlib
import json
from pathlib import Path
import httpx


def export(base_url, destination):
    destination.mkdir(parents=True, exist_ok=False)
    with httpx.Client(base_url=base_url, timeout=60, follow_redirects=True) as client:
        def get(path):
            response = client.get(path)
            response.raise_for_status()
            return response.json()
        data = {key: get(path) for key, path in {
            'company': '/api/company/', 'masters': '/api/orders/masters',
            'orders': '/api/orders/?status=all', 'receivables': '/api/receivables/summary',
            'stock': '/api/stock', 'gst': '/api/gst', 'tasks': '/api/tasks?status=all',
            'shipments': '/api/upload/shipments',
        }.items()}
        data['order_details'] = [get(f"/api/orders/{row['id']}") for row in data['orders']['orders']]
        data['statements'] = [get(f"/api/receivables/customers/{row['id']}") for row in data['masters']['customers']]
        documents = []
        for shipment in data['shipments']['shipments']:
            for form_id in shipment.get('generated_forms', []):
                response = client.get(f"/api/forms/{shipment['id']}/forms/{form_id}/download")
                response.raise_for_status()
                if not response.content.startswith(b'%PDF'):
                    raise RuntimeError('Expected a PDF')
                name = f"{shipment['id']}_{form_id}.pdf"
                (destination / name).write_bytes(response.content)
                documents.append({'file': name, 'key': f'data/forms/{name}',
                                  'sha256': hashlib.sha256(response.content).hexdigest()})
        data['documents'] = documents
        (destination / 'snapshot.json').write_text(json.dumps(data, indent=2))
    print(f"Saved {len(data['order_details'])} orders, {len(data['statements'])} customer statements, "
          f"{len(data['shipments']['shipments'])} shipments and {len(documents)} PDFs; no writes to the live app.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.base_url, args.output)
