from fastapi import APIRouter, UploadFile, File
import uuid
import os
from pathlib import Path
from datetime import datetime
from backend.models.shipment import Shipment
from backend.services.compliance_engine import analyze_shipment
from backend.routers.company import get_company_profile

router = APIRouter()
PROJECT_ROOT = Path(__file__).parent.parent.parent
UPLOADS_DIR = PROJECT_ROOT / "backend" / "uploads"

shipments_db = {}

@router.post("/")
async def upload_document(file: UploadFile = File(...)):
    shipment_id = str(uuid.uuid4())
    file_bytes = await file.read()
    
    file_path = UPLOADS_DIR / f"{shipment_id}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    shipments_db[shipment_id] = Shipment(
        id=shipment_id,
        filename=file.filename,
        status="analyzing",
        created_at=datetime.utcnow()
    )
    
    try:
        company_profile = get_company_profile()
        analysis_result = await analyze_shipment(file_bytes, file.filename, company_profile)
        
        shipments_db[shipment_id].status = "complete"
        shipments_db[shipment_id].extracted_data = analysis_result["extracted_data"]
        shipments_db[shipment_id].risk_report = analysis_result["risk_report"].model_dump()
        shipments_db[shipment_id].company_id = company_profile.id if company_profile else None
    except Exception as e:
        shipments_db[shipment_id].status = "error"
        
    return {"shipment_id": shipment_id, "status": shipments_db[shipment_id].status}

@router.get("/shipments")
def list_shipments():
    return {"shipments": [s.model_dump() for s in shipments_db.values()]}

@router.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: str):
    if shipment_id not in shipments_db:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipments_db[shipment_id].model_dump()
