from typing import Literal, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.services import receivables
from backend.services.assistant import reminder_with_ai
from backend.services.assistant_tools import company_name

router = APIRouter()


class PaymentIn(BaseModel):
    customer_id: int
    amount: float
    payment_date: Optional[str] = None
    reference: Optional[str] = None
    invoice_id: Optional[int] = None


class ReminderIn(BaseModel):
    language: Literal["en", "hinglish"] = "en"


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    return receivables.summary(db)


@router.get("/customers/{customer_id}")
def statement(customer_id: int, db: Session = Depends(get_db)):
    return receivables.customer_statement(db, customer_id)


@router.post("/payments")
def record_payment(payload: PaymentIn, db: Session = Depends(get_db)):
    return receivables.record_payment(db, payload.customer_id, payload.amount, payload.payment_date, payload.reference, payload.invoice_id)


@router.post("/customers/{customer_id}/reminder")
async def reminder(customer_id: int, payload: ReminderIn, db: Session = Depends(get_db)):
    statement = receivables.customer_statement(db, customer_id)
    text, mode = await reminder_with_ai(statement, payload.language, company_name())
    return {"text": text, "mode": mode, "whatsapp": statement["customer"]["whatsapp"], "customer": statement["customer"]["name"]}
