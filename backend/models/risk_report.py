from pydantic import BaseModel
from typing import List

class RiskFlag(BaseModel):
    severity: str
    description: str
    resolution: str

class RiskReport(BaseModel):
    status: str
    risk_score: int
    flags: List[RiskFlag]
