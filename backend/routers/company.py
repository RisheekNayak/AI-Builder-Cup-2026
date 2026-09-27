from fastapi import APIRouter
from backend.models.company import CompanyProfile
from pathlib import Path
import json
import os

router = APIRouter()
PROJECT_ROOT = Path(__file__).parent.parent.parent
COMPANY_FILE = PROJECT_ROOT / "backend" / "data" / "company-profile.json"

def get_company_profile() -> CompanyProfile | None:
    if os.path.exists(COMPANY_FILE):
        try:
            with open(COMPANY_FILE, "r") as f:
                data = json.load(f)
                return CompanyProfile(**data)
        except Exception:
            return None
    return None

@router.get("/")
def read_company_profile():
    return get_company_profile()

@router.post("/")
def save_company_profile(profile: CompanyProfile):
    with open(COMPANY_FILE, "w") as f:
        f.write(profile.model_dump_json())
    return {"status": "saved"}
