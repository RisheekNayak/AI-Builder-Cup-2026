from pydantic import BaseModel
from typing import Optional

class CompanyProfile(BaseModel):
    company_id: str
    name: str
    iec_code: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
