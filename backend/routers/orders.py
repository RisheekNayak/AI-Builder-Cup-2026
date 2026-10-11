from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.config import MAX_UPLOAD_BYTES
from backend.db import DEMO_ORG, get_db
from backend.models.business import Customer, Item
from backend.services import orders
from backend.services.business_common import BusinessError
from backend.services.document_ai import mime_type_for
from backend.services.po_capture import CaptureError, capture_po

router = APIRouter()


class OrderLineIn(BaseModel):
    item_id: Optional[int] = None
    description: Optional[str] = None
    qty: float
    rate: Optional[float] = None


class OrderIn(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    po_number: str
    po_date: str
    promised_date: str
    notes: Optional[str] = None
    lines: list[OrderLineIn]
    source: Optional[str] = "manual"


class DispatchLineIn(BaseModel):
    order_line_id: int
    qty: float


class DispatchIn(BaseModel):
    lines: list[DispatchLineIn]
    dispatch_date: Optional[str] = None
    challan_no: Optional[str] = None
    vehicle_no: Optional[str] = None
    eway_bill_no: Optional[str] = None
    recorded_by: Optional[str] = None
    create_invoice: bool = True


@router.get("/")
def list_orders(status: str = "open", due_within_days: Optional[int] = None, customer_id: Optional[int] = None, db: Session = Depends(get_db)):
    return {"orders": orders.list_orders(db, status=status, due_within_days=due_within_days, customer_id=customer_id)}


@router.get("/masters")
def masters(db: Session = Depends(get_db)):
    customers = db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG).order_by(Customer.name)).all()
    items = db.scalars(select(Item).where(Item.org_id == DEMO_ORG, Item.kind == "finished").order_by(Item.code)).all()
    return {
        "customers": [{"id": c.id, "name": c.name, "city": c.city, "country": c.country} for c in customers],
        "items": [{"id": i.id, "code": i.code, "name": i.name, "unit": i.unit, "rate": i.rate} for i in items],
    }


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    return orders.get_order(db, order_id)


@router.post("/")
def create_order(payload: OrderIn, db: Session = Depends(get_db)):
    source = payload.source if payload.source in ("manual", "document", "chat") else "manual"
    return orders.create_order(db, payload.model_dump(exclude={"source"}), source=source)


@router.post("/{order_id}/dispatches")
def record_dispatch(order_id: int, payload: DispatchIn, db: Session = Depends(get_db)):
    return orders.record_dispatch(db, order_id, payload.model_dump())


@router.post("/dispatches/{dispatch_id}/invoice")
def invoice_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    return orders.create_invoice_for_dispatch(db, dispatch_id)


@router.post("/capture")
async def capture(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise BusinessError("Choose a file smaller than 10 MB.")
    mime = mime_type_for(file.filename or "")
    if not mime:
        raise BusinessError("Upload the PO as a PDF, PNG or JPG.")
    try:
        return await capture_po(db, data, file.filename or "po.pdf", mime)
    except CaptureError as error:
        raise BusinessError(str(error))
