import re
from datetime import date
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from backend.db import DEMO_ORG, today
from backend.models.business import Customer, Dispatch, DispatchLine, Invoice, Item, OrderLine, SalesOrder
from backend.services.business_common import BusinessError, fy_label

GST_RATE = 0.18


def _orders_query():
    return (
        select(SalesOrder)
        .where(SalesOrder.org_id == DEMO_ORG)
        .options(
            selectinload(SalesOrder.customer),
            selectinload(SalesOrder.lines),
            selectinload(SalesOrder.dispatches).selectinload(Dispatch.lines),
        )
    )


def _dispatched_by_line(order: SalesOrder) -> dict[int, float]:
    shipped: dict[int, float] = {}
    for dispatch in order.dispatches:
        for line in dispatch.lines:
            shipped[line.order_line_id] = shipped.get(line.order_line_id, 0) + line.qty
    return shipped


def order_view(order: SalesOrder, as_of: date | None = None) -> dict:
    as_of = as_of or today()
    shipped = _dispatched_by_line(order)
    descriptions = {line.id: line.description for line in order.lines}
    lines = []
    for line in order.lines:
        done = shipped.get(line.id, 0)
        lines.append({
            "id": line.id, "item_id": line.item_id, "description": line.description,
            "qty": line.qty, "rate": line.rate, "dispatched": done, "open": max(line.qty - done, 0),
            "value": round(line.qty * line.rate, 2),
        })
    ordered = sum(line["qty"] for line in lines)
    dispatched = sum(min(line["dispatched"], line["qty"]) for line in lines)
    open_qty = max(ordered - dispatched, 0)
    if open_qty <= 0:
        status = "dispatched"
    elif order.promised_date < as_of:
        status = "late"
    elif dispatched > 0:
        status = "partial"
    else:
        status = "open"
    dispatches = [{
        "id": d.id, "dispatch_date": d.dispatch_date.isoformat(), "challan_no": d.challan_no,
        "vehicle_no": d.vehicle_no, "eway_bill_no": d.eway_bill_no, "recorded_by": d.recorded_by,
        "total_qty": sum(l.qty for l in d.lines),
        "lines": [{"order_line_id": l.order_line_id, "description": descriptions.get(l.order_line_id, ""), "qty": l.qty} for l in d.lines],
    } for d in order.dispatches]
    return {
        "id": order.id, "po_number": order.po_number, "po_date": order.po_date.isoformat(),
        "promised_date": order.promised_date.isoformat(), "due_in_days": (order.promised_date - as_of).days,
        "customer": {"id": order.customer.id, "name": order.customer.name, "city": order.customer.city, "country": order.customer.country},
        "status": status, "ordered_qty": ordered, "dispatched_qty": dispatched, "open_qty": open_qty,
        "progress": round(dispatched / ordered, 3) if ordered else 0,
        "order_value": round(sum(l["value"] for l in lines), 2),
        "open_value": round(sum(l["open"] * l["rate"] for l in lines), 2),
        "lines": lines, "dispatches": dispatches,
        "last_dispatch_date": dispatches[-1]["dispatch_date"] if dispatches else None,
        "notes": order.notes, "source": order.source, "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }


STATUS_RANK = {"late": 0, "partial": 1, "open": 2, "dispatched": 3}


def list_orders(db: Session, status: str = "open", due_within_days: int | None = None,
                customer_id: int | None = None, as_of: date | None = None) -> list[dict]:
    as_of = as_of or today()
    views = [order_view(o, as_of) for o in db.scalars(_orders_query()).all()]
    if customer_id:
        views = [v for v in views if v["customer"]["id"] == customer_id]
    if status == "open":
        views = [v for v in views if v["open_qty"] > 0]
    elif status in ("late", "partial", "dispatched"):
        views = [v for v in views if v["status"] == status]
    if due_within_days is not None:
        views = [v for v in views if v["open_qty"] > 0 and v["due_in_days"] <= due_within_days]
    views.sort(key=lambda v: (STATUS_RANK[v["status"]], v["promised_date"]))
    return views


def get_order(db: Session, order_id: int, as_of: date | None = None) -> dict:
    order = db.scalars(_orders_query().where(SalesOrder.id == order_id)).first()
    if not order:
        raise BusinessError("Order not found.")
    view = order_view(order, as_of)
    invoices = db.scalars(select(Invoice).where(Invoice.order_id == order_id).options(selectinload(Invoice.payments))).all()
    view["invoices"] = [{
        "id": inv.id, "number": inv.number, "invoice_date": inv.invoice_date.isoformat(), "amount": inv.amount,
        "paid": round(sum(p.amount for p in inv.payments), 2), "dispatch_id": inv.dispatch_id,
    } for inv in invoices]
    invoiced = {inv.dispatch_id for inv in invoices}
    for dispatch in view["dispatches"]:
        dispatch["invoiced"] = dispatch["id"] in invoiced
    return view


def find_orders(db: Session, text: str, as_of: date | None = None) -> list[dict]:
    """Match orders by PO number fragments or customer names mentioned in free text."""
    text_lower = text.lower()
    tokens = {t for t in re.findall(r"[a-z0-9/-]*\d[a-z0-9/-]*", text_lower) if len(t) >= 3}
    views = [order_view(o, as_of) for o in db.scalars(_orders_query()).all()]
    by_po = [v for v in views if any(t in v["po_number"].lower() or v["po_number"].lower().endswith(t) for t in tokens)]
    if by_po:
        return by_po
    return [v for v in views if customer_mentioned(v["customer"]["name"], text_lower)]


GENERIC_WORDS = {"auto", "systems", "system", "ltd", "llc", "pvt", "private", "limited", "motors", "parts", "traders", "the", "india"}


def customer_mentioned(name: str, text_lower: str) -> bool:
    words = [w for w in re.findall(r"[a-z]+", name.lower()) if len(w) > 2 and w not in GENERIC_WORDS]
    return any(re.search(rf"\b{re.escape(w)}\b", text_lower) for w in words)


def create_order(db: Session, data: dict, source: str = "manual") -> dict:
    customer_id = data.get("customer_id")
    customer = db.get(Customer, customer_id) if customer_id else None
    if not customer and data.get("customer_name"):
        name = data["customer_name"].strip()
        customer = db.scalars(select(Customer).where(func.lower(Customer.name) == name.lower())).first()
        if not customer:
            customer = Customer(name=name, gstin=data.get("customer_gstin"), city=data.get("customer_city"), source=source)
            db.add(customer)
            db.flush()
    if not customer:
        raise BusinessError("Choose a customer or enter a customer name.")
    po_number = (data.get("po_number") or "").strip()
    if not po_number:
        raise BusinessError("Enter the customer's PO number.")
    if db.scalars(select(SalesOrder).where(SalesOrder.customer_id == customer.id, SalesOrder.po_number == po_number)).first():
        raise BusinessError(f"PO {po_number} from {customer.name} is already in the order book.")
    try:
        po_date = date.fromisoformat(data["po_date"])
        promised = date.fromisoformat(data["promised_date"])
    except (KeyError, TypeError, ValueError):
        raise BusinessError("Enter valid PO and promised dates.")
    if promised < po_date:
        raise BusinessError("The promised date cannot be before the PO date.")
    lines = data.get("lines") or []
    if not lines:
        raise BusinessError("Add at least one order line.")
    order = SalesOrder(customer_id=customer.id, po_number=po_number, po_date=po_date, promised_date=promised,
                       notes=data.get("notes"), source=source)
    for raw in lines:
        quantity = float(raw.get("qty") or 0)
        if quantity <= 0:
            raise BusinessError("Each line needs a quantity greater than zero.")
        item = db.get(Item, raw["item_id"]) if raw.get("item_id") else None
        description = (raw.get("description") or (item.name if item else "")).strip()
        if not description:
            raise BusinessError("Each line needs an item or description.")
        rate = float(raw.get("rate") if raw.get("rate") not in (None, "") else (item.rate if item else 0))
        order.lines.append(OrderLine(item_id=item.id if item else None, description=description, qty=quantity, rate=rate))
    db.add(order)
    db.commit()
    return get_order(db, order.id)


def next_invoice_number(db: Session, day: date) -> str:
    prefix = f"SPC/{fy_label(day)}/"
    count = db.scalar(select(func.count()).select_from(Invoice).where(Invoice.number.like(f"{prefix}%"))) or 0
    return f"{prefix}{count + 101:04d}"


def record_dispatch(db: Session, order_id: int, data: dict, source: str = "manual") -> dict:
    order = db.scalars(_orders_query().where(SalesOrder.id == order_id)).first()
    if not order:
        raise BusinessError("Order not found.")
    shipped = _dispatched_by_line(order)
    lines_by_id = {line.id: line for line in order.lines}
    requested = [l for l in (data.get("lines") or []) if float(l.get("qty") or 0) > 0]
    if not requested:
        raise BusinessError("Enter a dispatch quantity for at least one line.")
    try:
        day = date.fromisoformat(data["dispatch_date"]) if data.get("dispatch_date") else today()
    except ValueError:
        raise BusinessError("Enter a valid dispatch date.")
    if day > today():
        raise BusinessError("Record dispatches on or before today. Use the promised date to plan future dispatches.")
    dispatch = Dispatch(order_id=order.id, dispatch_date=day, challan_no=data.get("challan_no") or None,
                        vehicle_no=data.get("vehicle_no") or None, eway_bill_no=data.get("eway_bill_no") or None,
                        recorded_by=data.get("recorded_by") or "Dispatch", source=source)
    value = 0.0
    for raw in requested:
        line = lines_by_id.get(int(raw["order_line_id"]))
        if not line:
            raise BusinessError("A dispatch line does not belong to this order.")
        quantity = float(raw["qty"])
        open_qty = line.qty - shipped.get(line.id, 0)
        if quantity > open_qty + 1e-9:
            raise BusinessError(f"{line.description}: only {open_qty:g} open, cannot dispatch {quantity:g}.")
        dispatch.lines.append(DispatchLine(order_line_id=line.id, qty=quantity))
        value += quantity * line.rate
        if line.item_id:
            item = db.get(Item, line.item_id)
            item.on_hand = max(item.on_hand - quantity, 0)
    db.add(dispatch)
    db.flush()
    invoice = None
    if data.get("create_invoice", True) and value > 0:
        invoice = Invoice(customer_id=order.customer_id, order_id=order.id, dispatch_id=dispatch.id,
                          number=next_invoice_number(db, day), invoice_date=day,
                          amount=round(value * (1 + GST_RATE), 2), source=source)
        db.add(invoice)
    db.commit()
    db.expire_all()
    result = get_order(db, order.id)
    result["new_dispatch_id"] = dispatch.id
    result["new_invoice"] = {"number": invoice.number, "amount": invoice.amount} if invoice else None
    return result


def dispatches_without_invoice(db: Session) -> list[dict]:
    invoiced = select(Invoice.dispatch_id).where(Invoice.dispatch_id.is_not(None))
    rows = db.scalars(select(Dispatch).where(Dispatch.id.not_in(invoiced)).options(
        selectinload(Dispatch.order).selectinload(SalesOrder.customer), selectinload(Dispatch.lines))).all()
    return [{"dispatch_id": d.id, "order_id": d.order_id, "po_number": d.order.po_number,
             "customer": d.order.customer.name, "dispatch_date": d.dispatch_date.isoformat(),
             "challan_no": d.challan_no, "qty": sum(l.qty for l in d.lines)} for d in rows]


def create_invoice_for_dispatch(db: Session, dispatch_id: int) -> dict:
    dispatch = db.scalars(select(Dispatch).where(Dispatch.id == dispatch_id).options(
        selectinload(Dispatch.lines), selectinload(Dispatch.order).selectinload(SalesOrder.lines))).first()
    if not dispatch:
        raise BusinessError("Dispatch not found.")
    if db.scalars(select(Invoice).where(Invoice.dispatch_id == dispatch_id)).first():
        raise BusinessError("This dispatch already has an invoice.")
    rates = {line.id: line.rate for line in dispatch.order.lines}
    value = sum(l.qty * rates.get(l.order_line_id, 0) for l in dispatch.lines)
    invoice = Invoice(customer_id=dispatch.order.customer_id, order_id=dispatch.order_id, dispatch_id=dispatch.id,
                      number=next_invoice_number(db, today()), invoice_date=today(),
                      amount=round(value * (1 + GST_RATE), 2))
    db.add(invoice)
    db.commit()
    return {"id": invoice.id, "number": invoice.number, "amount": invoice.amount, "order_id": dispatch.order_id}
