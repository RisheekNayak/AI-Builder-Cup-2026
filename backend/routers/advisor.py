from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.gemini import advisor_chat
from backend.services.vertex_search import search

router = APIRouter()

class ChatMessage(BaseModel):
    message: str

@router.post("/chat")
async def chat_advisor(msg: ChatMessage):
    search_results = await search(msg.message, top_k=3)
    response = await advisor_chat(msg.message, search_results)
    return response
