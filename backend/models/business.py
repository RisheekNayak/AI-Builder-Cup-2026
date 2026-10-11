from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db import Base, DEMO_ORG


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Stamped:
    org_id: Mapped[str] = mapped_column(String(40), default=DEMO_ORG, index=True)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # seed | manual | document | import | chat
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Customer(Stamped, Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    gstin: Mapped[Optional[str]] = mapped_column(String(15))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2), default="IN")
    credit_days: Mapped[int] = mapped_column(Integer, default=30)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100))
    whatsapp: Mapped[Optional[str]] = mapped_column(String(20))


class Item(Stamped, Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(200))
    hsn: Mapped[Optional[str]] = mapped_column(String(10))
    unit: Mapped[str] = mapped_column(String(10), default="pcs")
    rate: Mapped[float] = mapped_column(Float, default=0)
    on_hand: Mapped[float] = mapped_column(Float, default=0)
    reorder_level: Mapped[float] = mapped_column(Float, default=0)
    kind: Mapped[str] = mapped_column(String(10), default="finished")  # finished | raw


class SalesOrder(Stamped, Base):
    __tablename__ = "sales_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    po_number: Mapped[str] = mapped_column(String(60))
    po_date: Mapped[date] = mapped_column(Date)
    promised_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    customer: Mapped[Customer] = relationship()
    lines: Mapped[list["OrderLine"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    dispatches: Mapped[list["Dispatch"]] = relationship(back_populates="order", cascade="all, delete-orphan", order_by="Dispatch.dispatch_date")


class OrderLine(Base):
    __tablename__ = "order_lines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"))
    item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("items.id"))
    description: Mapped[str] = mapped_column(String(200))
    qty: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float, default=0)
    order: Mapped[SalesOrder] = relationship(back_populates="lines")
    item: Mapped[Optional[Item]] = relationship()


class Dispatch(Stamped, Base):
    __tablename__ = "dispatches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"))
    dispatch_date: Mapped[date] = mapped_column(Date)
    challan_no: Mapped[Optional[str]] = mapped_column(String(40))
    vehicle_no: Mapped[Optional[str]] = mapped_column(String(20))
    eway_bill_no: Mapped[Optional[str]] = mapped_column(String(20))
    recorded_by: Mapped[Optional[str]] = mapped_column(String(60))
    order: Mapped[SalesOrder] = relationship(back_populates="dispatches")
    lines: Mapped[list["DispatchLine"]] = relationship(back_populates="dispatch", cascade="all, delete-orphan")


class DispatchLine(Base):
    __tablename__ = "dispatch_lines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dispatch_id: Mapped[int] = mapped_column(ForeignKey("dispatches.id"))
    order_line_id: Mapped[int] = mapped_column(ForeignKey("order_lines.id"))
    qty: Mapped[float] = mapped_column(Float)
    dispatch: Mapped[Dispatch] = relationship(back_populates="lines")


class Invoice(Stamped, Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales_orders.id"))
    dispatch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("dispatches.id"))
    number: Mapped[str] = mapped_column(String(40))
    invoice_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)  # including GST
    irn_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    customer: Mapped[Customer] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")


class Payment(Stamped, Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"))
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    reference: Mapped[Optional[str]] = mapped_column(String(60))
    invoice: Mapped[Optional[Invoice]] = relationship(back_populates="payments")


class Task(Stamped, Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[Optional[str]] = mapped_column(Text)
    assignee_role: Mapped[str] = mapped_column(String(20), default="owner")
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    entity_type: Mapped[Optional[str]] = mapped_column(String(20))
    entity_id: Mapped[Optional[str]] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(10), default="open")


class JobWorkChallan(Stamped, Base):
    __tablename__ = "job_work_challans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    challan_no: Mapped[str] = mapped_column(String(40))
    job_worker: Mapped[str] = mapped_column(String(200))
    process: Mapped[str] = mapped_column(String(100))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    sent_date: Mapped[date] = mapped_column(Date)
    qty_sent: Mapped[float] = mapped_column(Float)
    qty_returned: Mapped[float] = mapped_column(Float, default=0)
    item: Mapped[Item] = relationship()


class ShipmentRecord(Stamped, Base):
    __tablename__ = "shipments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # uploaded | analyzing | complete | analysis_failed | error
    error: Mapped[Optional[str]] = mapped_column(Text)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSON)
    risk_report: Mapped[Optional[dict]] = mapped_column(JSON)
    fta_matches: Mapped[Optional[list]] = mapped_column(JSON)
    scomet_flags: Mapped[Optional[list]] = mapped_column(JSON)
    generated_forms: Mapped[Optional[list]] = mapped_column(JSON)
    dispatch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("dispatches.id"))
