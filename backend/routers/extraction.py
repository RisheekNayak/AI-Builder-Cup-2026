from fastapi import APIRouter, HTTPException
from backend.routers.upload import shipments_db

router = APIRouter()

@router.get("/{shipment_id}")
def get_extracted_data(shipment_id: str):
    if shipment_id not in shipments_db:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    return {"extracted_data": shipments_db[shipment_id].extracted_data}
