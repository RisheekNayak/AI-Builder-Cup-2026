from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

router = APIRouter()

class UploadResponse(BaseModel):
    document_id: str
    status: str
    message: str

@router.post("/", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Uploads a document (invoice, packing list, etc.) for processing.
    """
    # TODO: Save to GCS, return tracking ID
    return UploadResponse(document_id="doc_123", status="success", message="Document uploaded successfully")
