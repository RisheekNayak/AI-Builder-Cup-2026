from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any

router = APIRouter()

class ExtractionRequest(BaseModel):
    document_id: str

class ExtractionResponse(BaseModel):
    document_id: str
    extracted_data: Dict[str, Any]

@router.post("/extract", response_model=ExtractionResponse)
async def extract_data(request: ExtractionRequest):
    """
    Extracts structured data from a previously uploaded document.
    """
    # TODO: Call Document AI / Gemini service to extract data
    return ExtractionResponse(document_id=request.document_id, extracted_data={"invoice_number": "INV-001"})
