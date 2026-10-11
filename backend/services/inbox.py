from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import DEMO_ORG, today
from backend.models.business import ShipmentRecord, Task
from backend.services import gst_preview, orders, receivables, stock
from backend.services.business_common import inr, qty

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def task_view(task: Task) -> dict:
    return {"id": task.id, "title": task.title, "detail": task.detail, "assignee_role": task.assignee_role,
            "due_date": task.due_date.isoformat() if task.due_date else None, "entity_type": task.entity_type,
            "entity_id": task.entity_id, "status": task.status, "source": task.source}


def today_inbox(db: Session, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    items: list[dict] = []
    recv = receivables.summary(db, as_of)

    for c in recv["customers"]:
        if c["past_45"] > 0:
            items.append({
                "id": f"past45-{c['customer_id']}", "kind": "collection", "severity": "critical" if c["oldest_days"] > 60 else "high",
                "title": f"{c['name']}: {inr(c['past_45'])} unpaid past 45 days",
                "detail": f"Oldest invoice {c['oldest_days']} days. Total outstanding {inr(c['outstanding'])}.",
                "amount": c["past_45"], "entity": {"type": "customer", "id": c["customer_id"]},
                "actions": ["draft_reminder", "create_task"],
            })
    within = [c for c in recv["customers"] if c["overdue"] > 0 and c["past_45"] == 0]
    if within:
        amount = sum(c["overdue"] for c in within)
        items.append({
            "id": "overdue-within-45", "kind": "collection", "severity": "medium",
            "title": f"{inr(amount)} overdue with {len(within)} customer{'s' if len(within) > 1 else ''}",
            "detail": ", ".join(c["name"] for c in within) + ". Past the credit period.",
            "amount": amount, "entity": {"type": "receivables"}, "actions": ["open"],
        })

    for o in orders.list_orders(db, status="open", as_of=as_of):
        if o["status"] == "late":
            items.append({
                "id": f"late-{o['id']}", "kind": "order", "severity": "high",
                "title": f"PO {o['po_number']} for {o['customer']['name']} is {-o['due_in_days']} days late",
                "detail": f"{qty(o['open_qty'])} of {qty(o['ordered_qty'])} pcs still to dispatch ({inr(o['open_value'])}).",
                "amount": o["open_value"], "entity": {"type": "order", "id": o["id"]}, "actions": ["record_dispatch", "create_task"],
            })
        elif 0 <= o["due_in_days"] <= 3:
            when = "today" if o["due_in_days"] == 0 else f"in {o['due_in_days']} days"
            items.append({
                "id": f"due-{o['id']}", "kind": "order", "severity": "medium",
                "title": f"PO {o['po_number']} for {o['customer']['name']} is due {when}",
                "detail": f"{qty(o['open_qty'])} of {qty(o['ordered_qty'])} pcs still to dispatch.",
                "amount": o["open_value"], "entity": {"type": "order", "id": o["id"]}, "actions": ["record_dispatch"],
            })

    for d in orders.dispatches_without_invoice(db):
        items.append({
            "id": f"noinv-{d['dispatch_id']}", "kind": "invoice", "severity": "medium",
            "title": f"Dispatch on {date.fromisoformat(d['dispatch_date']).strftime('%d %b')} has no invoice",
            "detail": f"{qty(d['qty'])} pcs for PO {d['po_number']} ({d['customer']}). Billing is delayed until it is invoiced.",
            "amount": None, "entity": {"type": "order", "id": d["order_id"]}, "actions": ["create_invoice"],
            "payload": {"dispatch_id": d["dispatch_id"]},
        })

    shortages = stock.stock_overview(db)["shortages"]
    if shortages:
        for_orders = [s for s in shortages if s["short_for_orders"] > 0]
        items.append({
            "id": "stock", "kind": "stock", "severity": "high" if for_orders else "medium", "preview": True,
            "title": f"{len(shortages)} items below reorder level",
            "detail": ", ".join(f"{s['code']} (short {qty(s['shortfall'])} {s['unit']})" for s in shortages[:3]),
            "amount": None, "entity": {"type": "stock"}, "actions": ["open"],
        })

    gst = gst_preview.gst_overview(db, as_of)
    urgent_irn = [r for r in gst["irn_guard"] if r["days_left"] <= 5]
    if urgent_irn:
        items.append({
            "id": "irn", "kind": "gst", "severity": "high", "preview": True,
            "title": f"{len(urgent_irn)} invoice{'s' if len(urgent_irn) > 1 else ''} near the 30-day e-invoice limit",
            "detail": ", ".join(f"{r['number']} ({max(r['days_left'], 0)} days left)" for r in urgent_irn) + ". The buyer loses input credit if missed.",
            "amount": None, "entity": {"type": "gst"}, "actions": ["open"],
        })
    risky_jw = [r for r in gst["job_work"] if r["status"] != "ok"]
    if risky_jw:
        items.append({
            "id": "jobwork", "kind": "gst", "severity": "critical" if any(r["status"] == "deemed_supply" for r in risky_jw) else "medium", "preview": True,
            "title": f"Job-work material at risk with {len({r['job_worker'] for r in risky_jw})} job workers",
            "detail": "; ".join(f"{r['challan_no']} at {r['job_worker']}: {qty(r['qty_pending'])} {r['unit']}, {r['age_days']} days" for r in risky_jw)
                      + ". After 1 year GST treats it as a sale.",
            "amount": None, "entity": {"type": "gst"}, "actions": ["open"],
        })

    export_orders = [o for o in orders.list_orders(db, status="open", as_of=as_of) if o["customer"]["country"] != "IN"]
    reviewed = db.scalars(select(ShipmentRecord).where(ShipmentRecord.org_id == DEMO_ORG, ShipmentRecord.status == "complete")).all()
    if export_orders and not reviewed:
        o = export_orders[0]
        items.append({
            "id": f"export-{o['id']}", "kind": "export", "severity": "medium",
            "title": f"Export order {o['po_number']} has no compliance check",
            "detail": f"{o['customer']['name']}, due in {o['due_in_days']} days. Upload the export invoice to check SCOMET, FTA and documents.",
            "amount": o["open_value"], "entity": {"type": "new_shipment"}, "actions": ["open"],
        })
    for s in db.scalars(select(ShipmentRecord).where(ShipmentRecord.org_id == DEMO_ORG, ShipmentRecord.status.in_(["analysis_failed", "error"]))).all():
        items.append({
            "id": f"shipment-{s.id}", "kind": "export", "severity": "medium",
            "title": f"Export analysis failed for {s.filename}", "detail": s.error or "Open the shipment and retry the analysis.",
            "amount": None, "entity": {"type": "shipment", "id": s.id}, "actions": ["open"],
        })

    for t in db.scalars(select(Task).where(Task.org_id == DEMO_ORG, Task.status == "open")).all():
        if t.due_date and t.due_date <= as_of:
            items.append({
                "id": f"task-{t.id}", "kind": "task", "severity": "medium" if t.due_date < as_of else "low",
                "title": t.title, "detail": f"Assigned to {t.assignee_role}. {'Overdue' if t.due_date < as_of else 'Due today'}.",
                "amount": None, "entity": {"type": "task", "id": t.id}, "actions": ["complete_task"],
            })

    items.sort(key=lambda i: (SEVERITY_RANK[i["severity"]], -(i["amount"] or 0)))
    open_orders = orders.list_orders(db, status="open", as_of=as_of)
    return {
        "as_of": as_of.isoformat(),
        "kpis": {
            "outstanding": recv["total_outstanding"], "past_45": recv["past_45"], "overdue": recv["overdue"],
            "open_orders": len(open_orders), "late_orders": sum(1 for o in open_orders if o["status"] == "late"),
            "due_this_week": sum(1 for o in open_orders if 0 <= o["due_in_days"] <= 7),
        },
        "items": items,
    }
