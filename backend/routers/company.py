from fastapi import APIRouter
from models.company import CompanyProfile

router = APIRouter()

@router.get("/{company_id}", response_model=CompanyProfile)
async def get_company_profile(company_id: str):
    """
    Gets company details including IEC code, GSTIN, etc.
    """
    # TODO: Fetch from DB
    return CompanyProfile(company_id=company_id, name="Test Exporter", iec_code="1234567890")
