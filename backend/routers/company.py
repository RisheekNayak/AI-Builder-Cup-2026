from fastapi import APIRouter
from backend.models.company import CompanyProfile
from backend.services.storage import get_storage

router = APIRouter()

def get_company_profile() -> CompanyProfile | None:
    raw = get_storage().read("data/company-profile.json")
    return CompanyProfile.model_validate_json(raw) if raw is not None else None


@router.get("/")
def read_company_profile():
    return get_company_profile()


@router.post("/")
def save_company_profile(profile: CompanyProfile):
    get_storage().write("data/company-profile.json", profile.model_dump_json().encode(), "application/json")
    return {"status": "saved"}
