from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models.shipment import ExtractedData
from backend.routers.upload import get_record, run_analysis, shipment_view
from backend.services.business_common import BusinessError

router = APIRouter()


@router.get("/{shipment_id}/risk-report")
def get_risk_report(shipment_id: str, db: Session = Depends(get_db)):
    rec = get_record(db, shipment_id)
    return {"status": rec.status, "risk_report": rec.risk_report if rec.status == "complete" else None,
            "fta_matches": rec.fta_matches or [], "scomet_flags": rec.scomet_flags or [], "error": rec.error}


@router.post("/{shipment_id}/analyze")
async def analyze_shipment(shipment_id: str, db: Session = Depends(get_db)):
    rec = get_record(db, shipment_id)
    if not rec.extracted_data:
        raise BusinessError("This shipment has no extracted invoice data. Upload the invoice again.")
    await run_analysis(db, rec, ExtractedData(**rec.extracted_data))
    return shipment_view(rec)
