from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    context_id: str = None

class ChatResponse(BaseModel):
    reply: str
    sources: list

@router.post("/chat", response_model=ChatResponse)
async def advisor_chat(request: ChatRequest):
    """
    AI Copilot chat endpoint for asking export compliance questions.
    """
    # TODO: Route to Gemini with Vertex Search context
    return ChatResponse(reply="Based on DGFT rules...", sources=[])
