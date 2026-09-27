from fastapi import APIRouter, HTTPException, Response
from backend.routers.upload import shipments_db
from backend.routers.company import get_company_profile
from backend.services.form_generator import generate_shipping_bill, generate_certificate_of_origin, generate_end_user_undertaking

router = APIRouter()
forms_db = {}

@router.post("/{shipment_id}/generate")
def generate_forms(shipment_id: str):
    if shipment_id not in shipments_db:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    shipment = shipments_db[shipment_id]
    if shipment.status != "complete" or not shipment.extracted_data:
        raise HTTPException(status_code=400, detail="Shipment analysis not complete")
        
    company_profile = get_company_profile()
    
    sb_pdf = generate_shipping_bill(shipment.extracted_data, company_profile, None)
    forms_db[f"{shipment_id}_shipping_bill"] = sb_pdf
    
    co_pdf = generate_certificate_of_origin(shipment.extracted_data, company_profile, [])
    forms_db[f"{shipment_id}_coo"] = co_pdf
    
    euu_pdf = generate_end_user_undertaking(shipment.extracted_data, company_profile, [])
    forms_db[f"{shipment_id}_euu"] = euu_pdf
    
    return {"status": "Forms generated successfully"}

@router.get("/{shipment_id}/forms")
def list_forms(shipment_id: str):
    return {
        "forms": [
            {"id": "shipping_bill", "name": "Shipping Bill"},
            {"id": "coo", "name": "Certificate of Origin"},
            {"id": "euu", "name": "End User Undertaking"}
        ]
    }

@router.get("/{shipment_id}/forms/{form_id}/download")
def download_form(shipment_id: str, form_id: str):
    key = f"{shipment_id}_{form_id}"
    if key not in forms_db:
        raise HTTPException(status_code=404, detail="Form not found")
        
    return Response(content=forms_db[key], media_type="application/pdf")
