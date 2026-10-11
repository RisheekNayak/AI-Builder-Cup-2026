"""Business tools the assistant can call. Every number comes from the database, never from the model."""
import re
from dataclasses import dataclass, field
from datetime import timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import DEMO_ORG, today
from backend.models.business import Customer, ShipmentRecord
from backend.services import gst_preview, inbox, orders, receivables, stock
from backend.services.business_common import BusinessError, inr, qty
from backend.services.deterministic import check_fta_eligibility, countries_in_text, country_code
from backend.services.vertex_search import search


@dataclass
class ToolResult:
    data: dict
    citations: list = field(default_factory=list)
    panel: dict | None = None
    actions: list = field(default_factory=list)
    followups: list = field(default_factory=list)


def company_name() -> str:
    from backend.routers.company import get_company_profile
    profile = get_company_profile()
    return profile.name if profile and profile.name else "Shree Precision Components"


def resolve_customer(db: Session, name: str | None) -> Customer | None:
    if not name:
        return None
    text = name.lower()
    customers = db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG)).all()
    for c in customers:
        if c.name.lower() == text or text in c.name.lower():
            return c
    for c in customers:
        if orders.customer_mentioned(c.name, text):
            return c
    return None


def customers_in_text(db: Session, text: str) -> list[Customer]:
    lower = text.lower()
    return [c for c in db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG)).all() if orders.customer_mentioned(c.name, lower)]


def _customer_cite(c: dict | Customer) -> dict:
    name = c["name"] if isinstance(c, dict) else c.name
    cid = c.get("customer_id", c.get("id")) if isinstance(c, dict) else c.id
    return {"label": name, "kind": "customer", "id": cid}


# ---------- read tools ----------

def receivables_summary(db: Session, focus: str = "all") -> ToolResult:
    s = receivables.summary(db)
    customers = s["customers"]
    if focus == "past_45":
        customers = [c for c in customers if c["past_45"] > 0]
    elif focus == "overdue":
        customers = [c for c in customers if c["overdue"] > 0]
    data = {
        "as_of": s["as_of"], "total_outstanding": inr(s["total_outstanding"]), "overdue": inr(s["overdue"]),
        "past_45_days": inr(s["past_45"]), "customers_past_45": s["past_45_customers"],
        "collected_this_month": inr(s["collected_this_month"]),
        "ageing": [{"bucket": b["label"], "amount": inr(b["amount"]), "invoices": b["count"]} for b in s["buckets"]],
        "customers": [{"name": c["name"], "outstanding": inr(c["outstanding"]), "overdue": inr(c["overdue"]),
                       "past_45_days": inr(c["past_45"]), "oldest_invoice_days": c["oldest_days"],
                       "export_customer": c["country"] != "IN"} for c in customers],
        "note": "Past 45 days applies to domestic buyers (MSMED Act / Sec 43B(h)). Export customers are tracked against their credit period.",
    }
    top = customers[0]["name"] if customers else None
    return ToolResult(data, [{"label": "Receivables ledger", "kind": "receivables"}] + [_customer_cite(c) for c in customers[:4]],
                      {"kind": "receivables"}, followups=[f"Draft a reminder for {top}", f"Show {top} statement"] if top else [])


def customer_statement(db: Session, customer: str) -> ToolResult:
    c = resolve_customer(db, customer)
    if not c:
        return ToolResult({"error": f"No customer matching '{customer}'."})
    st = receivables.customer_statement(db, c.id)
    open_rows = [r for r in st["invoices"] if r["status"] != "paid"]
    data = {
        "customer": c.name, "credit_days": c.credit_days, "outstanding": inr(st["outstanding"]), "overdue": inr(st["overdue"]),
        "past_45_days": inr(st["past_45"]),
        "open_invoices": [{"number": r["number"], "date": r["invoice_date"], "balance": inr(r["balance"]), "age_days": r["age_days"],
                           "status": r["status"], "past_45": r["past_45"]} for r in open_rows],
        "last_payment": st["payments"][0] if st["payments"] else None,
    }
    if data["last_payment"]:
        data["last_payment"] = {**data["last_payment"], "amount": inr(data["last_payment"]["amount"])}
    return ToolResult(data, [_customer_cite(c)] + [{"label": r["number"], "kind": "customer", "id": c.id} for r in open_rows[:3]],
                      {"kind": "customer", "id": c.id, "title": c.name},
                      followups=[f"Draft a reminder for {c.name}", f"Show open orders for {c.name}"])


def _order_brief(o: dict) -> dict:
    return {
        "po_number": o["po_number"], "customer": o["customer"]["name"], "status": o["status"],
        "promised_date": o["promised_date"], "due_in_days": o["due_in_days"],
        "ordered": qty(o["ordered_qty"]), "dispatched": qty(o["dispatched_qty"]), "open": qty(o["open_qty"]),
        "open_value": inr(o["open_value"]),
        "dispatches": [{"date": d["dispatch_date"], "qty": qty(d["total_qty"]), "challan": d["challan_no"],
                        "vehicle": d["vehicle_no"], "recorded_by": d["recorded_by"]} for d in o["dispatches"]],
        "lines": [{"item": l["description"], "ordered": qty(l["qty"]), "dispatched": qty(l["dispatched"]), "open": qty(l["open"])} for l in o["lines"]],
    }


def search_orders(db: Session, query: str) -> ToolResult:
    found = orders.find_orders(db, query)
    if not found:
        return ToolResult({"error": f"No order matches '{query}'. Try the PO number or customer name."})
    if len(found) == 1:
        o = orders.get_order(db, found[0]["id"])
        brief = _order_brief(o)
        brief["invoices"] = [{"number": i["number"], "amount": inr(i["amount"]), "paid": inr(i["paid"])} for i in o["invoices"]]
        uninvoiced = [d for d in o["dispatches"] if not d.get("invoiced")]
        brief["dispatches_without_invoice"] = len(uninvoiced)
        follow = [f"Record a dispatch for {o['po_number']}"] if o["open_qty"] > 0 else []
        return ToolResult({"order": brief}, [{"label": f"PO {o['po_number']}", "kind": "order", "id": o["id"]}],
                          {"kind": "order", "id": o["id"], "title": o["po_number"]},
                          followups=follow + [f"Show {o['customer']['name']} statement"])
    return ToolResult({"orders": [_order_brief(o) for o in found]},
                      [{"label": f"PO {o['po_number']}", "kind": "order", "id": o["id"]} for o in found[:5]],
                      {"kind": "orders", "filter": "all"})


def open_orders(db: Session, filter: str = "open", customer: str | None = None) -> ToolResult:
    c = resolve_customer(db, customer) if customer else None
    if filter == "due_this_week":
        rows = orders.list_orders(db, status="open", due_within_days=7, customer_id=c.id if c else None)
    else:
        rows = orders.list_orders(db, status=filter if filter in ("open", "late", "dispatched", "partial", "all") else "open",
                                  customer_id=c.id if c else None)
    data = {"filter": filter, "customer": c.name if c else None, "count": len(rows),
            "open_value": inr(sum(o["open_value"] for o in rows)), "orders": [_order_brief(o) for o in rows[:10]]}
    return ToolResult(data, [{"label": f"PO {o['po_number']}", "kind": "order", "id": o["id"]} for o in rows[:5]],
                      {"kind": "orders", "filter": filter},
                      followups=["Which orders are late?", "What is due this week?"])


def stock_shortages(db: Session) -> ToolResult:
    s = stock.stock_overview(db)["shortages"]
    data = {"preview": True, "shortages": [{"code": i["code"], "name": i["name"], "unit": i["unit"], "on_hand": qty(i["on_hand"]),
                                            "reserved_for_open_orders": qty(i["reserved"]), "reorder_level": qty(i["reorder_level"]),
                                            "shortfall": qty(i["shortfall"]), "short_for_orders": qty(i["short_for_orders"])} for i in s]}
    return ToolResult(data, [{"label": "Stock register (preview)", "kind": "stock"}], {"kind": "stock"})


def gst_deadlines(db: Session) -> ToolResult:
    g = gst_preview.gst_overview(db)
    data = {"preview": True, "calendar": g["calendar"],
            "einvoice_limit": [{**r, "amount": inr(r["amount"])} for r in g["irn_guard"]],
            "job_work": g["job_work"]}
    return ToolResult(data, [{"label": "GST calendar (preview)", "kind": "gst"}], {"kind": "gst"})


def list_shipments(db: Session, destination: str | None = None) -> ToolResult:
    rows = db.scalars(select(ShipmentRecord).where(ShipmentRecord.org_id == DEMO_ORG).order_by(ShipmentRecord.created_at.desc())).all()
    code = country_code(destination) if destination else None
    items = []
    for s in rows:
        ed = s.extracted_data or {}
        if code and (country_code(ed.get("buyer_country") or "") != code):
            continue
        items.append({"id": s.id, "invoice": ed.get("invoice_number") or s.filename, "buyer": ed.get("buyer_name"),
                      "destination": ed.get("buyer_country"), "status": s.status,
                      "risk": (s.risk_report or {}).get("overall_score"), "uploaded": s.created_at.date().isoformat()})
    return ToolResult({"shipments": items, "destination_filter": code},
                      [{"label": i["invoice"], "kind": "shipment", "id": i["id"]} for i in items[:4]], {"kind": "history"},
                      followups=["Create a new shipment"])


async def policy_search(question: str) -> ToolResult:
    results = await search(question, top_k=4)
    countries = set(countries_in_text(question))
    ftas = [{"country": c, "agreements": [{"name": a.get("name"), "origin_criteria": a.get("origin_criteria"),
                                           "certificate": a.get("certificate_form_name"), "benefits": a.get("key_benefits")}
                                          for a in check_fta_eligibility(c)]} for c in sorted(countries)]
    return ToolResult({"knowledge_base": results, "fta_by_country": ftas},
                      [{"label": r.get("title") or r.get("source"), "kind": "source", "url": r.get("source") if str(r.get("source", "")).startswith("http") else None}
                       for r in results[:3] if r.get("source")])


def today_summary(db: Session) -> ToolResult:
    data = inbox.today_inbox(db)
    k = data["kpis"]
    return ToolResult({"kpis": {"outstanding": inr(k["outstanding"]), "past_45_days": inr(k["past_45"]), "open_orders": k["open_orders"],
                                "late_orders": k["late_orders"], "due_this_week": k["due_this_week"]},
                       "top_items": [{"severity": i["severity"], "title": i["title"], "detail": i["detail"]} for i in data["items"][:6]]},
                      [{"label": "Today inbox", "kind": "inbox"}])


# ---------- proposal tools (the user confirms in the UI) ----------

def draft_reminder(db: Session, customer: str, language: str = "en") -> ToolResult:
    c = resolve_customer(db, customer)
    if not c:
        return ToolResult({"error": f"No customer matching '{customer}'."})
    st = receivables.customer_statement(db, c.id)
    if st["outstanding"] <= 0:
        return ToolResult({"customer": c.name, "message": "Nothing is outstanding for this customer."}, [_customer_cite(c)])
    text = receivables.reminder_text(st, "hinglish" if language == "hinglish" else "en", company_name())
    return ToolResult({"customer": c.name, "outstanding": inr(st["outstanding"]), "reminder_drafted": True},
                      [_customer_cite(c)], {"kind": "customer", "id": c.id, "title": c.name},
                      [{"type": "reminder", "title": f"Reminder to {c.name}", "text": text, "whatsapp": c.whatsapp,
                        "payload": {"customer_id": c.id}},
                       {"type": "create_task", "title": f"Follow up with {c.name} on payment",
                        "payload": {"title": f"Follow up with {c.name} on {inr(st['outstanding'])} outstanding", "assignee_role": "accounts",
                                    "due_date": (today() + timedelta(days=2)).isoformat(), "entity_type": "customer", "entity_id": str(c.id)}}])


def propose_payment(db: Session, customer: str, amount: float, reference: str | None = None) -> ToolResult:
    c = resolve_customer(db, customer)
    if not c:
        return ToolResult({"error": f"No customer matching '{customer}'."})
    st = receivables.customer_statement(db, c.id)
    if amount <= 0 or amount > st["outstanding"] + 0.5:
        return ToolResult({"error": f"{inr(amount)} does not fit: {c.name} has {inr(st['outstanding'])} outstanding."}, [_customer_cite(c)])
    return ToolResult({"customer": c.name, "amount": inr(amount), "outstanding_before": inr(st["outstanding"]), "awaiting_confirmation": True},
                      [_customer_cite(c)], {"kind": "customer", "id": c.id, "title": c.name},
                      [{"type": "record_payment", "title": f"Record {inr(amount)} received from {c.name}",
                        "detail": "Applied to the oldest open invoices first.",
                        "payload": {"customer_id": c.id, "amount": amount, "reference": reference}}])


def propose_task(db: Session, title: str, assignee_role: str = "owner", due_in_days: int = 1) -> ToolResult:
    due = today() + timedelta(days=max(int(due_in_days), 0))
    role = assignee_role if assignee_role in ("owner", "accounts", "sales", "stores", "dispatch", "production") else "owner"
    return ToolResult({"task": title, "assignee_role": role, "due_date": due.isoformat(), "awaiting_confirmation": True}, [], None,
                      [{"type": "create_task", "title": f"Create task for {role}: {title}",
                        "payload": {"title": title, "assignee_role": role, "due_date": due.isoformat()}}])


def propose_dispatch(db: Session, po_number: str, quantity: float | None = None) -> ToolResult:
    found = orders.find_orders(db, po_number)
    if len(found) != 1:
        return ToolResult({"error": f"Could not identify a single order for '{po_number}'."})
    o = found[0]
    open_lines = [l for l in o["lines"] if l["open"] > 0]
    if not open_lines:
        return ToolResult({"po_number": o["po_number"], "message": "This order is fully dispatched."},
                          [{"label": f"PO {o['po_number']}", "kind": "order", "id": o["id"]}])
    lines = []
    remaining = quantity
    for l in open_lines:
        q = l["open"] if remaining is None else min(l["open"], remaining)
        if q > 0:
            lines.append({"order_line_id": l["id"], "qty": q, "description": l["description"]})
        if remaining is not None:
            remaining -= q
    total = sum(l["qty"] for l in lines)
    return ToolResult({"po_number": o["po_number"], "dispatch_qty": qty(total), "open_before": qty(o["open_qty"]), "awaiting_confirmation": True},
                      [{"label": f"PO {o['po_number']}", "kind": "order", "id": o["id"]}],
                      {"kind": "order", "id": o["id"], "title": o["po_number"]},
                      [{"type": "record_dispatch", "title": f"Record dispatch of {qty(total)} pcs for PO {o['po_number']}",
                        "detail": "An invoice is created with the dispatch (18% GST).",
                        "payload": {"order_id": o["id"], "lines": [{"order_line_id": l["order_line_id"], "qty": l["qty"]} for l in lines]}}])


# Declarations exposed to Gemini function calling.
DECLARATIONS = [
    ("today_summary", "What needs attention today: KPIs and prioritised alerts across collections, orders, stock and GST.", {}),
    ("receivables_summary", "Money owed by customers: total outstanding, overdue, unpaid past 45 days, ageing buckets, per-customer list.",
     {"focus": {"type": "string", "enum": ["all", "overdue", "past_45"]}}),
    ("customer_statement", "One customer's open invoices, balances, ages and last payment.", {"customer": {"type": "string"}}, ["customer"]),
    ("search_orders", "Find a customer order by PO number or customer name, including dispatch history (when shipped, how many).",
     {"query": {"type": "string"}}, ["query"]),
    ("open_orders", "List orders by status.", {"filter": {"type": "string", "enum": ["open", "late", "due_this_week", "dispatched", "all"]},
                                              "customer": {"type": "string"}}),
    ("stock_shortages", "Items below reorder level after reserving stock for open orders (preview data).", {}),
    ("gst_deadlines", "GST and statutory due dates this month, invoices near the 30-day e-invoice limit, job-work material near 1 year (preview).", {}),
    ("list_shipments", "Export shipments checked for compliance, optionally by destination country.", {"destination": {"type": "string"}}),
    ("policy_search", "Search export policy knowledge base (SCOMET, FTA, documents) and FTA coverage for countries mentioned.",
     {"question": {"type": "string"}}, ["question"]),
    ("draft_reminder", "Draft a payment reminder message for a customer. The user sends it.",
     {"customer": {"type": "string"}, "language": {"type": "string", "enum": ["en", "hinglish"]}}, ["customer"]),
    ("propose_payment", "Prepare a payment receipt for the user to confirm.",
     {"customer": {"type": "string"}, "amount": {"type": "number"}, "reference": {"type": "string"}}, ["customer", "amount"]),
    ("propose_task", "Prepare a follow-up task for the user to confirm.",
     {"title": {"type": "string"}, "assignee_role": {"type": "string", "enum": ["owner", "accounts", "sales", "stores", "dispatch", "production"]},
      "due_in_days": {"type": "integer"}}, ["title"]),
    ("propose_dispatch", "Prepare a dispatch record for an order for the user to confirm.",
     {"po_number": {"type": "string"}, "quantity": {"type": "number"}}, ["po_number"]),
]

SYNC_TOOLS = {
    "today_summary": today_summary, "receivables_summary": receivables_summary, "customer_statement": customer_statement,
    "search_orders": search_orders, "open_orders": open_orders, "stock_shortages": stock_shortages, "gst_deadlines": gst_deadlines,
    "list_shipments": list_shipments, "draft_reminder": draft_reminder, "propose_payment": propose_payment,
    "propose_task": propose_task, "propose_dispatch": propose_dispatch,
}


async def run_tool(db: Session, name: str, args: dict) -> ToolResult:
    try:
        if name == "policy_search":
            return await policy_search(args.get("question", ""))
        fn = SYNC_TOOLS.get(name)
        if not fn:
            return ToolResult({"error": f"Unknown tool {name}"})
        return fn(db, **{k: v for k, v in args.items() if v is not None})
    except BusinessError as error:
        return ToolResult({"error": str(error)})
    except TypeError as error:
        return ToolResult({"error": f"Bad arguments for {name}: {error}"})
