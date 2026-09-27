from fastapi import APIRouter, HTTPException
from backend.routers.upload import shipments_db

router = APIRouter()

@router.get("/{shipment_id}/risk-report")
def get_risk_report(shipment_id: str):
    if shipment_id not in shipments_db:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    shipment = shipments_db[shipment_id]
    if shipment.status != "complete":
        return {"status": shipment.status, "risk_report": None}
        
    return {"status": shipment.status, "risk_report": shipment.risk_report}

@router.post("/{shipment_id}/analyze")
async def analyze_shipment(shipment_id: str):
    return {"status": "Re-analysis triggered", "shipment_id": shipment_id}
