from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from backend.db import DEMO_ORG, today
from backend.models.business import Invoice, JobWorkChallan

IRP_LIMIT_DAYS = 30
JOB_WORK_LIMIT_DAYS = 365

# Standard monthly due dates. CBIC/EPFO extensions are not tracked in this preview.
MONTHLY_DUE = [
    (7, "TDS deposit", "Tax deducted last month"),
    (11, "GSTR-1", "Outward supplies of last month"),
    (15, "PF & ESI deposit", "Employee contributions of last month"),
    (20, "GSTR-3B", "Summary return and tax payment"),
]


def calendar(as_of: date) -> list[dict]:
    entries = []
    for day, name, detail in MONTHLY_DUE:
        due = as_of.replace(day=day)
        entries.append({"name": name, "detail": detail, "due_date": due.isoformat(), "days_left": (due - as_of).days})
    # ITC-04 (job work) is half-yearly for turnover above ₹5 Cr: 25 Oct (Apr–Sep) and 25 Apr (Oct–Mar).
    for month, period in ((10, "Apr–Sep"), (4, "Oct–Mar")):
        if as_of.month == month:
            due = as_of.replace(day=25)
            entries.append({"name": "ITC-04", "detail": f"Job-work challans, {period}", "due_date": due.isoformat(), "days_left": (due - as_of).days})
    return sorted(entries, key=lambda e: e["due_date"])


def irn_guard(db: Session, as_of: date) -> list[dict]:
    """Invoices without an e-invoice IRN approaching the 30-day reporting limit (turnover ₹10 Cr and above)."""
    rows = db.scalars(select(Invoice).where(Invoice.org_id == DEMO_ORG, Invoice.irn_generated.is_(False))
                      .options(selectinload(Invoice.customer))).all()
    result = []
    for inv in rows:
        age = (as_of - inv.invoice_date).days
        if age < 20:
            continue
        result.append({"invoice_id": inv.id, "number": inv.number, "customer": inv.customer.name, "amount": inv.amount,
                       "invoice_date": inv.invoice_date.isoformat(), "age_days": age, "days_left": IRP_LIMIT_DAYS - age})
    return sorted(result, key=lambda r: r["days_left"])


def job_work(db: Session, as_of: date) -> list[dict]:
    rows = db.scalars(select(JobWorkChallan).where(JobWorkChallan.org_id == DEMO_ORG).options(selectinload(JobWorkChallan.item))).all()
    result = []
    for ch in rows:
        pending = ch.qty_sent - ch.qty_returned
        if pending <= 0:
            continue
        age = (as_of - ch.sent_date).days
        days_left = JOB_WORK_LIMIT_DAYS - age
        status = "deemed_supply" if days_left < 0 else ("due_soon" if age >= 270 else "ok")
        result.append({"challan_no": ch.challan_no, "job_worker": ch.job_worker, "process": ch.process,
                       "item": f"{ch.item.code} {ch.item.name}", "unit": ch.item.unit, "sent_date": ch.sent_date.isoformat(),
                       "qty_sent": ch.qty_sent, "qty_pending": pending, "age_days": age, "days_left": days_left, "status": status})
    return sorted(result, key=lambda r: r["days_left"])


def gst_overview(db: Session, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    return {"as_of": as_of.isoformat(), "calendar": calendar(as_of), "irn_guard": irn_guard(db, as_of), "job_work": job_work(db, as_of)}
