"""One-time, create-only import. Run with approved project credentials.
Never overwrites an existing Firestore dataset or differing storage objects.
"""
import argparse
import hashlib
import json
from pathlib import Path
from backend.services.firestore_state import get_state_store
from backend.services.storage import get_storage
from infra.prepare_firestore_import import prepare


def import_demo(directory, store=None, objects=None):
    snapshot_bytes = (directory / 'snapshot.json').read_bytes()
    snapshot = json.loads(snapshot_bytes)
    payloads = prepare(snapshot)  # Revalidate; never trust a detached import file.
    store = store or get_state_store()
    objects = objects or get_storage()
    version, existing = store.load()
    if version or existing:
        raise RuntimeError('Destination already contains records; refusing to overwrite')
    documents = []
    if snapshot['company'] is not None:
        documents.append(('data/company-profile.json', json.dumps(snapshot['company']).encode(), 'application/json'))
    for document in snapshot['documents']:
        name = document['file']
        if Path(name).name != name:
            raise ValueError('Invalid document filename')
        data = (directory / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != document['sha256']:
            raise RuntimeError('Document checksum mismatch')
        documents.append((document['key'], data, 'application/pdf'))
    digest = hashlib.sha256(snapshot_bytes).hexdigest()
    documents.append((f'backups/{digest}/snapshot.json', snapshot_bytes, 'application/json'))
    # Preflight every existing object before writing anything.
    for key, data, _ in documents:
        current = objects.read(key)
        if current is not None and current != data:
            raise RuntimeError(f'Destination object differs: {key}')
    for key, data, content_type in documents:
        objects.create(key, data, content_type)
        if objects.read(key) != data:
            raise RuntimeError(f'Destination verification failed: {key}')
    store.save(0, payloads, {})
    imported_version, imported = store.load()
    if imported_version != 1 or imported != payloads:
        raise RuntimeError('Firestore readback mismatch; do not switch traffic')
    print(f'Imported and read back {len(payloads)} tables; backup SHA256 {digest}. Traffic unchanged.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    import_demo(args.directory)
