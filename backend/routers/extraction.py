from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models.shipment import ExtractedData
from backend.routers.upload import get_record, run_analysis, shipment_view

router = APIRouter()


@router.get("/{shipment_id}")
def get_extracted_data(shipment_id: str, db: Session = Depends(get_db)):
    return {"extracted_data": get_record(db, shipment_id).extracted_data}


@router.patch("/{shipment_id}")
async def update_extracted_data(shipment_id: str, payload: ExtractedData, db: Session = Depends(get_db)):
    """Save corrected invoice fields and re-run the compliance analysis."""
    rec = get_record(db, shipment_id)
    rec.status = "analyzing"
    db.commit()
    await run_analysis(db, rec, payload)
    return shipment_view(rec)
