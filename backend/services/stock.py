from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import DEMO_ORG
from backend.models.business import Item
from backend.services.orders import list_orders


def reserved_by_item(db: Session) -> dict[int, float]:
    reserved: dict[int, float] = {}
    for order in list_orders(db, status="open"):
        for line in order["lines"]:
            if line["item_id"] and line["open"] > 0:
                reserved[line["item_id"]] = reserved.get(line["item_id"], 0) + line["open"]
    return reserved


def stock_overview(db: Session) -> dict:
    reserved = reserved_by_item(db)
    items = []
    for item in db.scalars(select(Item).where(Item.org_id == DEMO_ORG).order_by(Item.kind, Item.code)).all():
        held = reserved.get(item.id, 0)
        available = item.on_hand - held
        shortfall = max(item.reorder_level - available, 0)
        items.append({
            "id": item.id, "code": item.code, "name": item.name, "kind": item.kind, "unit": item.unit, "hsn": item.hsn,
            "on_hand": item.on_hand, "reserved": held, "available": available, "reorder_level": item.reorder_level,
            "shortfall": shortfall, "short_for_orders": max(held - item.on_hand, 0), "below_reorder": shortfall > 0,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })
    shortages = sorted([i for i in items if i["below_reorder"]], key=lambda i: (-i["short_for_orders"], -i["shortfall"]))
    return {"items": items, "shortages": shortages}
