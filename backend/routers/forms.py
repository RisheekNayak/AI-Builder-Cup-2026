from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models.shipment import ExtractedData
from backend.models.risk_report import RiskReport
from backend.routers.company import get_company_profile
from backend.routers.upload import get_record
from backend.services.storage import get_storage
from backend.services.business_common import BusinessError
from backend.services.form_generator import FormGenerationError, generate_certificate_of_origin, generate_shipping_bill

router = APIRouter()
FORM_NAMES = {"shipping_bill": "Shipping Bill", "coo": "Certificate of Origin", "euu": "End User Undertaking"}
UNSUPPORTED = {"euu": "Not supported yet. Prepare it with the SCOMET licence application on the DGFT portal."}


def required_form_ids(rec) -> list[str]:
    names = [n.lower() for n in (rec.risk_report or {}).get("required_forms", [])]
    ids = ["shipping_bill"]
    if any("origin" in n for n in names) or rec.fta_matches:
        ids.append("coo")
    if any("end user" in n or "euu" in n for n in names) or rec.scomet_flags:
        ids.append("euu")
    return ids


def _reason(form_id: str, rec) -> str:
    if form_id == "shipping_bill":
        return "Needed for every export clearance (file on ICEGATE through your customs broker)."
    if form_id == "coo":
        return f"Claims preferential duty under {rec.fta_matches[0]['name']}." if rec.fta_matches else "Buyer or bank may ask for proof of origin."
    return "Required because an item may fall under SCOMET."


@router.post("/{shipment_id}/generate")
def generate_forms(shipment_id: str, db: Session = Depends(get_db)):
    rec = get_record(db, shipment_id)
    if rec.status != "complete" or not rec.extracted_data:
        raise BusinessError("Run the compliance analysis before generating forms.")
    data = ExtractedData(**rec.extracted_data)
    profile = get_company_profile()
    generated = []
    try:
        for form_id in required_form_ids(rec):
            if form_id == "shipping_bill":
                pdf = generate_shipping_bill(data, profile, RiskReport(**rec.risk_report) if rec.risk_report else None)
            elif form_id == "coo":
                pdf = generate_certificate_of_origin(data, profile, rec.fta_matches or [])
            else:
                continue
            get_storage().write(f"data/forms/{rec.id}_{form_id}.pdf", pdf, "application/pdf")
            generated.append(form_id)
    except FormGenerationError as error:
        raise BusinessError(str(error))
    rec.generated_forms = generated
    db.commit()
    return {"status": "generated", "forms": list_forms(shipment_id, db)["forms"]}


@router.get("/{shipment_id}/forms")
def list_forms(shipment_id: str, db: Session = Depends(get_db)):
    rec = get_record(db, shipment_id)
    generated = set(rec.generated_forms or [])
    forms = []
    for form_id in required_form_ids(rec):
        status = "unsupported" if form_id in UNSUPPORTED else ("generated" if form_id in generated else "not_generated")
        forms.append({"id": form_id, "name": FORM_NAMES[form_id], "status": status,
                      "reason": UNSUPPORTED.get(form_id) or _reason(form_id, rec)})
    return {"forms": forms}


@router.get("/{shipment_id}/forms/{form_id}/download")
def download_form(shipment_id: str, form_id: str, db: Session = Depends(get_db)):
    rec = get_record(db, shipment_id)
    if form_id not in FORM_NAMES or form_id not in (rec.generated_forms or []):
        raise HTTPException(status_code=404, detail="Form not generated yet")
    content = get_storage().read(f"data/forms/{rec.id}_{form_id}.pdf")
    if content is None:
        raise HTTPException(status_code=404, detail="Form not generated yet")
    return Response(content=content, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{FORM_NAMES.get(form_id, form_id)}.pdf"'})
