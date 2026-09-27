from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

class CompanyProfile(BaseModel):
    id: Optional[str] = None
    name: str
    iec_code: str = Field(..., description="10 chars alphanumeric")
    gstin: str = Field(..., description="15 chars alphanumeric")
    pan: str = Field(..., description="10 chars ABCDE1234F")
    ad_code: str = Field(..., description="14 chars alphanumeric")
    factory_address: str
    state_code: str
    port_of_loading: str
    authorized_signatory: str
    signatory_designation: str

    @field_validator('iec_code')
    @classmethod
    def validate_iec(cls, v: str) -> str:
        if not re.match(r'^[A-Z0-9]{10}$', v.upper()):
            raise ValueError('IEC must be 10 alphanumeric characters')
        return v.upper()

    @field_validator('gstin')
    @classmethod
    def validate_gstin(cls, v: str) -> str:
        if not re.match(r'^[A-Z0-9]{15}$', v.upper()):
            raise ValueError('GSTIN must be 15 alphanumeric characters')
        return v.upper()

    @field_validator('pan')
    @classmethod
    def validate_pan(cls, v: str) -> str:
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', v.upper()):
            raise ValueError('PAN must be in format ABCDE1234F')
        return v.upper()
