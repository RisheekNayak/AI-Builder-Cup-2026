from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from backend.db import DEMO_ORG, today
from backend.models.business import Customer, Invoice, Payment
from backend.services.business_common import BusinessError, inr

PAID_TOLERANCE = 0.5
MSME_PAYMENT_LIMIT_DAYS = 45
BUCKETS = [("0-30", "0–30 days", 0, 30), ("31-45", "31–45 days", 31, 45), ("46-60", "46–60 days", 46, 60), ("60+", "60+ days", 61, 10**6)]


def _bucket(age: int) -> str:
    for key, _, low, high in BUCKETS:
        if low <= age <= high:
            return key
    return "0-30"


def invoice_rows(db: Session, as_of: date | None = None, customer_id: int | None = None, open_only: bool = True) -> list[dict]:
    as_of = as_of or today()
    query = select(Invoice).where(Invoice.org_id == DEMO_ORG).options(selectinload(Invoice.payments), selectinload(Invoice.customer))
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)
    rows = []
    for inv in db.scalars(query).all():
        paid = round(sum(p.amount for p in inv.payments), 2)
        balance = round(inv.amount - paid, 2)
        if open_only and balance <= PAID_TOLERANCE:
            continue
        age = (as_of - inv.invoice_date).days
        due = inv.invoice_date + timedelta(days=inv.customer.credit_days)
        overdue_days = max((as_of - due).days, 0) if balance > PAID_TOLERANCE else 0
        domestic = inv.customer.country == "IN"
        rows.append({
            "id": inv.id, "number": inv.number, "invoice_date": inv.invoice_date.isoformat(), "due_date": due.isoformat(),
            "amount": inv.amount, "paid": paid, "balance": max(balance, 0), "age_days": age, "overdue_days": overdue_days,
            "bucket": _bucket(age),
            "past_45": domestic and balance > PAID_TOLERANCE and age > MSME_PAYMENT_LIMIT_DAYS,
            "status": "paid" if balance <= PAID_TOLERANCE else ("overdue" if overdue_days > 0 else "due"),
            "customer_id": inv.customer_id, "customer_name": inv.customer.name, "domestic": domestic,
            "order_id": inv.order_id, "dispatch_id": inv.dispatch_id, "irn_generated": inv.irn_generated,
        })
    rows.sort(key=lambda r: r["invoice_date"])
    return rows


def customers_outstanding(db: Session, as_of: date | None = None) -> list[dict]:
    rows = invoice_rows(db, as_of)
    customers = {c.id: c for c in db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG)).all()}
    grouped: dict[int, dict] = {}
    for r in rows:
        c = customers[r["customer_id"]]
        g = grouped.setdefault(c.id, {
            "customer_id": c.id, "name": c.name, "city": c.city, "country": c.country, "credit_days": c.credit_days,
            "contact_name": c.contact_name, "whatsapp": c.whatsapp,
            "outstanding": 0.0, "overdue": 0.0, "past_45": 0.0, "invoice_count": 0, "oldest_days": 0,
        })
        g["outstanding"] += r["balance"]
        g["invoice_count"] += 1
        g["oldest_days"] = max(g["oldest_days"], r["age_days"])
        if r["overdue_days"] > 0:
            g["overdue"] += r["balance"]
        if r["past_45"]:
            g["past_45"] += r["balance"]
    result = [{**g, "outstanding": round(g["outstanding"], 2), "overdue": round(g["overdue"], 2), "past_45": round(g["past_45"], 2)}
              for g in grouped.values()]
    result.sort(key=lambda g: (-g["past_45"], -g["overdue"], -g["outstanding"]))
    return result


def summary(db: Session, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    rows = invoice_rows(db, as_of)
    buckets = []
    for key, label, _, _ in BUCKETS:
        in_bucket = [r for r in rows if r["bucket"] == key]
        buckets.append({"key": key, "label": label, "amount": round(sum(r["balance"] for r in in_bucket), 2), "count": len(in_bucket)})
    month_start = as_of.replace(day=1)
    collected = db.scalars(select(Payment).where(Payment.org_id == DEMO_ORG, Payment.payment_date >= month_start, Payment.payment_date <= as_of)).all()
    customers = customers_outstanding(db, as_of)
    return {
        "as_of": as_of.isoformat(),
        "total_outstanding": round(sum(r["balance"] for r in rows), 2),
        "overdue": round(sum(r["balance"] for r in rows if r["overdue_days"] > 0), 2),
        "past_45": round(sum(r["balance"] for r in rows if r["past_45"]), 2),
        "past_45_customers": sum(1 for c in customers if c["past_45"] > 0),
        "collected_this_month": round(sum(p.amount for p in collected), 2),
        "open_invoices": len(rows),
        "buckets": buckets,
        "customers": customers,
    }


def customer_statement(db: Session, customer_id: int, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    customer = db.get(Customer, customer_id)
    if not customer:
        raise BusinessError("Customer not found.")
    invoices = invoice_rows(db, as_of, customer_id=customer_id, open_only=False)
    open_rows = [r for r in invoices if r["status"] != "paid"]
    payments = db.scalars(select(Payment).where(Payment.customer_id == customer_id).options(selectinload(Payment.invoice))
                          .order_by(Payment.payment_date.desc())).all()
    return {
        "customer": {"id": customer.id, "name": customer.name, "city": customer.city, "country": customer.country,
                     "gstin": customer.gstin, "credit_days": customer.credit_days, "contact_name": customer.contact_name,
                     "whatsapp": customer.whatsapp},
        "as_of": as_of.isoformat(),
        "outstanding": round(sum(r["balance"] for r in open_rows), 2),
        "overdue": round(sum(r["balance"] for r in open_rows if r["overdue_days"] > 0), 2),
        "past_45": round(sum(r["balance"] for r in open_rows if r["past_45"]), 2),
        "invoices": sorted(invoices, key=lambda r: (r["status"] == "paid", r["invoice_date"])),
        "payments": [{"id": p.id, "payment_date": p.payment_date.isoformat(), "amount": p.amount, "reference": p.reference,
                      "invoice_number": p.invoice.number if p.invoice else None} for p in payments],
    }


def record_payment(db: Session, customer_id: int, amount: float, payment_date: str | None = None,
                   reference: str | None = None, invoice_id: int | None = None, source: str = "manual") -> dict:
    if not db.get(Customer, customer_id):
        raise BusinessError("Customer not found.")
    if not amount or amount <= 0:
        raise BusinessError("Enter a payment amount greater than zero.")
    try:
        day = date.fromisoformat(payment_date) if payment_date else today()
    except ValueError:
        raise BusinessError("Enter a valid payment date.")
    if day > today():
        raise BusinessError("The payment date cannot be in the future.")
    open_rows = [r for r in invoice_rows(db, customer_id=customer_id) if r["balance"] > PAID_TOLERANCE]
    if invoice_id:
        open_rows = [r for r in open_rows if r["id"] == invoice_id]
        if not open_rows:
            raise BusinessError("That invoice is already fully paid or does not belong to this customer.")
    outstanding = sum(r["balance"] for r in open_rows)
    if amount > outstanding + PAID_TOLERANCE:
        raise BusinessError(f"{inr(amount)} is more than the {inr(outstanding)} outstanding. Record the advance in Tally instead.")
    remaining = amount
    allocations = []
    for r in open_rows:  # oldest invoice first
        if remaining <= 0:
            break
        applied = round(min(remaining, r["balance"]), 2)
        db.add(Payment(customer_id=customer_id, invoice_id=r["id"], payment_date=day, amount=applied, reference=reference, source=source))
        allocations.append({"invoice_number": r["number"], "amount": applied})
        remaining = round(remaining - applied, 2)
    db.commit()
    return {"allocations": allocations, "statement": customer_statement(db, customer_id)}


def reminder_text(statement: dict, language: str = "en", company_name: str | None = None) -> str:
    customer = statement["customer"]
    open_rows = [r for r in statement["invoices"] if r["status"] != "paid"]
    overdue = [r for r in open_rows if r["overdue_days"] > 0] or open_rows
    lines = "\n".join(f"• {r['number']} dated {date.fromisoformat(r['invoice_date']).strftime('%d %b %Y')}: {inr(r['balance'])} ({r['age_days']} days)" for r in overdue)
    total = inr(sum(r["balance"] for r in overdue))
    sender = company_name or "our accounts team"
    contact = customer.get("contact_name") or "Sir/Madam"
    legal = any(r["past_45"] for r in overdue)
    if language == "hinglish":
        text = (f"Namaste {contact} ji,\n\n{sender} ke neeche diye gaye invoices ka payment aapki taraf se pending hai:\n{lines}\n\n"
                f"Total pending: {total}.\n")
        if legal:
            text += "Kuch invoices 45 din se purane hain. MSME rules (Sec 43B(h)) ke hisaab se payment 45 din mein hona chahiye.\n"
        text += f"Kripya payment date confirm kar dein. Agar payment ho chuka hai to UTR share kar dein.\n\nDhanyavaad,\n{sender}"
        return text
    text = (f"Dear {contact},\n\nThis is a reminder that the following invoices from {sender} are pending:\n{lines}\n\n"
            f"Total due: {total}.\n")
    if legal:
        text += ("Some of these invoices are more than 45 days old. Under the MSMED Act and Section 43B(h), "
                 "payments to micro and small suppliers are due within 45 days.\n")
    text += "Please share the expected payment date, or the UTR if payment has already been made.\n\nRegards,\n" + sender
    return text
