"""Reconstruct API-visible demo records and verify totals before any cloud writes.
Internal timestamps/dispatch-line IDs not exposed by the old API are reconstructed.
The raw snapshot is kept as independent preservation evidence.
"""
import argparse
import json
from datetime import date, datetime
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from backend.db import Base
from backend.models.business import Customer, Item, SalesOrder, OrderLine, Dispatch, DispatchLine, Invoice, Payment, Task, JobWorkChallan, ShipmentRecord
from backend.services.firestore_state import encode_tables, hydrate
from backend.services.seed import ITEMS
from backend.services import orders, receivables, stock, gst_preview, inbox
from sqlalchemy import select


def prepare(snapshot):
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    as_of = date.fromisoformat(snapshot['receivables']['as_of'])
    raw_rates = {row[0]: row[5] for row in ITEMS}
    rates = {row['id']: row['rate'] for row in snapshot['masters']['items']}
    with Session(engine) as session:
        for statement in snapshot['statements']:
            session.add(Customer(**statement['customer'], source='import'))
        for row in snapshot['stock']['items']:
            rate = rates.get(row['id'], raw_rates.get(row['code']))
            if rate is None:
                raise RuntimeError(f"Cannot recover item rate for {row['code']}")
            fields = {key: row[key] for key in ('id', 'code', 'name', 'unit', 'kind', 'hsn', 'on_hand', 'reorder_level')}
            session.add(Item(**fields, rate=rate, source='import', updated_at=datetime.fromisoformat(row['updated_at'])))
        session.flush()
        for row in snapshot['order_details']:
            fields = {key: row[key] for key in ('id', 'po_number', 'notes', 'source')}
            session.add(SalesOrder(**fields, customer_id=row['customer']['id'], po_date=date.fromisoformat(row['po_date']),
                                   promised_date=date.fromisoformat(row['promised_date']), updated_at=datetime.fromisoformat(row['updated_at'])))
            for line in row['lines']:
                session.add(OrderLine(order_id=row['id'], **{key: line[key] for key in ('id', 'item_id', 'description', 'qty', 'rate')}))
            for dispatch in row['dispatches']:
                fields = {key: dispatch[key] for key in ('id', 'challan_no', 'vehicle_no', 'eway_bill_no', 'recorded_by')}
                session.add(Dispatch(**fields, order_id=row['id'], dispatch_date=date.fromisoformat(dispatch['dispatch_date']), source='import'))
                for line in dispatch['lines']:
                    session.add(DispatchLine(dispatch_id=dispatch['id'], order_line_id=line['order_line_id'], qty=line['qty']))
        session.flush()
        for statement in snapshot['statements']:
            customer_id = statement['customer']['id']
            invoice_ids = {}
            for row in statement['invoices']:
                fields = {key: row[key] for key in ('id', 'number', 'amount', 'order_id', 'dispatch_id', 'irn_generated')}
                session.add(Invoice(**fields, customer_id=customer_id, invoice_date=date.fromisoformat(row['invoice_date']), source='import'))
                invoice_ids[row['number']] = row['id']
            for row in statement['payments']:
                if row['invoice_number'] and row['invoice_number'] not in invoice_ids:
                    raise RuntimeError('Cannot match payment to invoice')
                session.add(Payment(id=row['id'], customer_id=customer_id, invoice_id=invoice_ids.get(row['invoice_number']),
                                    payment_date=date.fromisoformat(row['payment_date']), amount=row['amount'], reference=row['reference'], source='import'))
        for row in snapshot['tasks']['tasks']:
            fields = dict(row)
            fields['due_date'] = date.fromisoformat(row['due_date']) if row['due_date'] else None
            session.add(Task(**fields))
        item_by_code = {row['code']: row['id'] for row in snapshot['stock']['items']}
        for row in snapshot['gst']['job_work']:
            session.add(JobWorkChallan(challan_no=row['challan_no'], job_worker=row['job_worker'], process=row['process'],
                        item_id=item_by_code[row['item'].split()[0]], sent_date=date.fromisoformat(row['sent_date']),
                        qty_sent=row['qty_sent'], qty_returned=row['qty_sent']-row['qty_pending'], source='import'))
        for row in snapshot['shipments']['shipments']:
            fields = {key: row.get(key) for key in ('id', 'filename', 'status', 'error', 'extracted_data', 'risk_report', 'fta_matches', 'scomet_flags', 'generated_forms', 'dispatch_id')}
            session.add(ShipmentRecord(**fields, source='import', created_at=datetime.fromisoformat(row['created_at'].removesuffix('Z'))))
        session.commit()
        # Compare user-visible records, not only aggregate counts.
        assert receivables.summary(session, as_of) == snapshot['receivables'], 'Receivables mismatch'
        for statement in snapshot['statements']:
            assert receivables.customer_statement(session, statement['customer']['id'], as_of) == statement, 'Statement mismatch'
        for expected in snapshot['order_details']:
            assert orders.get_order(session, expected['id'], as_of) == expected, 'Order mismatch'
        assert gst_preview.gst_overview(session, as_of) == snapshot['gst'], 'GST mismatch'
        assert stock.stock_overview(session) == snapshot['stock'], 'Stock mismatch'
        restored_tasks = [inbox.task_view(t) for t in session.scalars(select(Task).order_by(Task.due_date)).all()]
        assert restored_tasks == snapshot['tasks']['tasks'], 'Tasks mismatch'
        payloads = encode_tables(session)
    engine.dispose()
    return payloads


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    payloads = prepare(snapshot)
    args.output.write_text(json.dumps({'schema_version': 1, 'tables': payloads}, indent=2))
    print(f'Validated {len(payloads)} tables against the preserved orders, statements, totals and GST preview. No cloud writes.')
