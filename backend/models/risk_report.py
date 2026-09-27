from pydantic import BaseModel
from typing import List, Optional, Literal

class RiskFlag(BaseModel):
    severity: Literal['low','medium','high','critical']
    title: str
    description: str
    policy_citation: str
    recommendation: str

class RiskReport(BaseModel):
    overall_score: Literal['low','medium','high','critical']
    flags: List[RiskFlag]
    required_forms: List[str]
    duty_savings: Optional[str] = None
    analysis_summary: str
