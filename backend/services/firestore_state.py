"""Bounded single-demo persistence: Firestore snapshots, SQLite query projections.

Existing business rules run on a request-local, disposable relational projection.
Firestore is authoritative. A version check atomically commits all changed tables;
concurrent writers fail visibly rather than overwriting another payment/dispatch.
This adapter is intentionally for the small hackathon dataset, not a general ERP.
"""
import json
import os
from datetime import date, datetime
from functools import lru_cache
from sqlalchemy import create_engine, select, Date, DateTime
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

MAX_TABLE_BYTES = 500_000


class StateConflict(RuntimeError):
    pass


class StateCapacityError(RuntimeError):
    pass


def tables():
    from backend.db import Base
    import backend.models.business  # noqa
    return Base.metadata.sorted_tables


def encode_tables(session):
    result = {}
    for table in tables():
        rows = []
        for row in session.execute(select(table).order_by(*table.primary_key.columns)).mappings():
            rows.append({k: v.isoformat() if isinstance(v, (date, datetime)) else v for k, v in row.items()})
        payload = json.dumps(rows, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        if len(payload.encode()) > MAX_TABLE_BYTES:
            raise StateCapacityError(f'{table.name} exceeds the demo storage limit; no changes were saved.')
        result[table.name] = payload
    return result


def hydrate(engine, payloads):
    from backend.db import Base
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        for table in tables():
            rows = json.loads(payloads.get(table.name, '[]'))
            for row in rows:
                for column in table.columns:
                    value = row.get(column.name)
                    if value is not None and isinstance(column.type, DateTime):
                        row[column.name] = datetime.fromisoformat(value)
                    elif value is not None and isinstance(column.type, Date):
                        row[column.name] = date.fromisoformat(value)
            if rows:
                connection.execute(table.insert(), rows)


class FirestoreState:
    def __init__(self):
        from google.cloud import firestore
        self.client = firestore.Client(project=os.getenv('GCP_PROJECT_ID'),
                                       database=os.getenv('SHIPSURE_FIRESTORE_DATABASE', '(default)'))
        self.root = self.client.collection('shipsure_demo_state').document('demo')

    def load(self):
        from google.cloud import firestore

        @firestore.transactional
        def read(transaction):
            metadata = self.root.get(transaction=transaction)
            if not metadata.exists:
                return 0, {}
            value = metadata.to_dict()
            if value.get('schema_version') != 1:
                raise RuntimeError('Unsupported Firestore state schema')
            refs = [self.root.collection('tables').document(t.name) for t in tables()]
            snapshots = self.client.get_all(refs, transaction=transaction)
            payloads = {doc.id: doc.to_dict()['payload'] for doc in snapshots if doc.exists}
            if set(payloads) != {table.name for table in tables()}:
                raise RuntimeError('Incomplete Firestore state; refusing to serve empty records')
            return value['version'], payloads

        return read(self.client.transaction())

    def save(self, expected_version, payloads, previous):
        from google.cloud import firestore
        changed = {key: payload for key, payload in payloads.items() if previous.get(key) != payload}
        if not changed and expected_version:
            return expected_version

        @firestore.transactional
        def write(transaction):
            snapshot = self.root.get(transaction=transaction)
            current = snapshot.to_dict()['version'] if snapshot.exists else 0
            if current != expected_version:
                raise StateConflict('Records changed in another request. Refresh and try again; this action was not saved.')
            for key, payload in changed.items():
                transaction.set(self.root.collection('tables').document(key), {'payload': payload})
            transaction.set(self.root, {'schema_version': 1, 'version': current + 1})
            return current + 1

        return write(self.client.transaction())


@lru_cache(maxsize=1)
def get_state_store():
    return FirestoreState()


class FirestoreSession(Session):
    def __init__(self, store=None):
        self.store = store or get_state_store()
        self.version, self.previous = self.store.load()
        self.projection = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        hydrate(self.projection, self.previous)
        super().__init__(bind=self.projection, expire_on_commit=False)

    def commit(self):
        self.flush()
        payloads = encode_tables(self)
        if payloads != self.previous:
            try:
                self.version = self.store.save(self.version, payloads, self.previous)
            except Exception:
                self.rollback()
                raise
        super().commit()
        self.previous = payloads

    def close(self):
        super().close()
        self.projection.dispose()
