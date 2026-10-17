import uuid
import asyncio
from backend.services.storage import get_storage
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.config import MAX_UPLOAD_BYTES
from backend.db import DEMO_ORG, get_db
from backend.models.business import ShipmentRecord
from backend.models.shipment import ExtractedData
from backend.services.business_common import BusinessError
from backend.services.compliance_engine import analyze_extracted
from backend.services.document_ai import ExtractionError, load_sample, process_document

router = APIRouter()
ALLOWED_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".json"}


def shipment_view(rec: ShipmentRecord) -> dict:
    return {
        "id": rec.id, "filename": rec.filename, "status": rec.status, "error": rec.error,
        "extracted_data": rec.extracted_data, "risk_report": rec.risk_report,
        "fta_matches": rec.fta_matches or [], "scomet_flags": rec.scomet_flags or [],
        "generated_forms": rec.generated_forms or [], "dispatch_id": rec.dispatch_id,
        "created_at": rec.created_at.isoformat() + "Z",
    }


def get_record(db: Session, shipment_id: str) -> ShipmentRecord:
    rec = db.get(ShipmentRecord, shipment_id)
    if not rec or rec.org_id != DEMO_ORG:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return rec


async def run_analysis(db: Session, rec: ShipmentRecord, extracted: ExtractedData):
    result = await analyze_extracted(extracted)
    rec.extracted_data = extracted.model_dump()
    rec.risk_report = result["risk_report"].model_dump()
    rec.fta_matches = result["fta_matches"]
    rec.scomet_flags = result["scomet_flags"]
    # Old objects are no longer downloadable once generated_forms is cleared.
    # Retain them for recovery; a bucket lifecycle policy can expire orphaned objects.
    rec.generated_forms = []
    rec.status = "complete"
    rec.error = None
    db.commit()


async def _create_and_analyze(db: Session, data: bytes, filename: str) -> dict:
    rec = ShipmentRecord(id=str(uuid.uuid4()), filename=filename, status="analyzing")
    db.add(rec)
    db.commit()
    try:
        await asyncio.to_thread(get_storage().write, f"uploads/{rec.id}{Path(filename).suffix.lower()}", data)
    except Exception:
        rec.status = "error"
        rec.error = "Invoice storage is unavailable. Please try uploading again."
        db.commit()
        raise HTTPException(status_code=503, detail=rec.error)
    try:
        extracted = await process_document(data, filename)
    except ExtractionError as error:
        rec.status = "error"
        rec.error = str(error)
        db.commit()
        return {"shipment_id": rec.id, "status": rec.status, "error": rec.error}
    try:
        await run_analysis(db, rec, extracted)
    except Exception as error:  # keep the extracted data so the user can retry
        rec.extracted_data = extracted.model_dump()
        rec.status = "analysis_failed"
        rec.error = f"Compliance analysis failed: {error}"
        db.commit()
    return {"shipment_id": rec.id, "status": rec.status, "error": rec.error}


@router.post("/")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = Path(file.filename or "invoice").name
    if Path(filename).suffix.lower() not in ALLOWED_SUFFIXES:
        raise BusinessError("Upload a PDF, PNG, JPG or JSON invoice.")
    data = await file.read()
    if not data:
        raise BusinessError("This file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise BusinessError("Choose an invoice smaller than 10 MB.")
    return await _create_and_analyze(db, data, filename)


@router.post("/sample/{name}")
async def upload_sample(name: str, db: Session = Depends(get_db)):
    try:
        data, filename = load_sample(name)
    except ExtractionError as error:
        raise BusinessError(str(error))
    return await _create_and_analyze(db, data, f"sample-{filename}")


@router.get("/shipments")
def list_shipments(db: Session = Depends(get_db)):
    rows = db.scalars(select(ShipmentRecord).where(ShipmentRecord.org_id == DEMO_ORG).order_by(ShipmentRecord.created_at.desc())).all()
    return {"shipments": [shipment_view(r) for r in rows]}


@router.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: str, db: Session = Depends(get_db)):
    return shipment_view(get_record(db, shipment_id))
