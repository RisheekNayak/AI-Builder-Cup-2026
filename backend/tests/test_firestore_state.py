import copy
import pytest
from sqlalchemy import select
from backend.services.firestore_state import FirestoreSession, StateConflict


class MemoryState:
    def __init__(self):
        self.version = 0
        self.payloads = {}

    def load(self):
        return self.version, copy.deepcopy(self.payloads)

    def save(self, expected, payloads, previous):
        if expected != self.version:
            raise StateConflict('Concurrent update')
        self.payloads = copy.deepcopy(payloads)
        self.version += 1
        return self.version


@pytest.fixture
def state():
    from backend.services.seed import seed
    store = MemoryState()
    with FirestoreSession(store) as session:
        seed(session)
    return store


def test_payment_survives_complete_session_recreation(state):
    from backend.services import receivables
    with FirestoreSession(state) as first:
        before = receivables.summary(first)['total_outstanding']
        result = receivables.record_payment(first, 1, 1000, reference='firestore test')
        assert sum(row['amount'] for row in result['allocations']) == 1000
    with FirestoreSession(state) as reopened:
        assert receivables.summary(reopened)['total_outstanding'] == pytest.approx(before - 1000)
        assert any(p['reference'] == 'firestore test' for p in receivables.customer_statement(reopened, 1)['payments'])


def test_concurrent_payments_cannot_overwrite_each_other(state):
    from backend.services import receivables
    with FirestoreSession(state) as first, FirestoreSession(state) as stale:
        before = receivables.summary(first)['total_outstanding']
        receivables.record_payment(first, 1, 1000)
        with pytest.raises(StateConflict):
            receivables.record_payment(stale, 1, 500)
    with FirestoreSession(state) as reopened:
        assert receivables.summary(reopened)['total_outstanding'] == pytest.approx(before - 1000)


def test_dispatch_and_invoice_persist_as_one_atomic_state_change(state):
    from backend.services import orders
    with FirestoreSession(state) as session:
        order = next(o for o in orders.list_orders(session, status='all') if o['po_number'] == 'WML-88213')
        result = orders.record_dispatch(session, order['id'], {'lines': [{'order_line_id': order['lines'][0]['id'], 'qty': 600}]})
        assert result['new_invoice']['amount'] == pytest.approx(600 * 260 * 1.18)
    with FirestoreSession(state) as session:
        restored = orders.get_order(session, order['id'])
        assert restored['status'] == 'dispatched'
        assert any(invoice['number'] == result['new_invoice']['number'] for invoice in restored['invoices'])


def test_failed_durable_commit_does_not_report_payment_success(state, monkeypatch):
    from backend.services import receivables
    before = state.load()
    monkeypatch.setattr(state, 'save', lambda *args: (_ for _ in ()).throw(RuntimeError('Cloud unavailable')))
    with FirestoreSession(state) as session:
        with pytest.raises(RuntimeError, match='Cloud unavailable'):
            receivables.record_payment(session, 1, 1000)
    assert state.load() == before


def test_read_only_requests_do_not_write_firestore(state):
    from backend.services import receivables
    before = state.version
    with FirestoreSession(state) as session:
        receivables.summary(session)
        session.commit()
    assert state.version == before


def test_table_capacity_failure_keeps_authoritative_state(state, monkeypatch):
    from backend.services import firestore_state
    from backend.models.business import Task
    before = state.load()
    with FirestoreSession(state) as session:
        session.add(Task(title='new task'))
        monkeypatch.setattr(firestore_state, 'MAX_TABLE_BYTES', 10)
        with pytest.raises(firestore_state.StateCapacityError):
            session.commit()
    assert state.load() == before
