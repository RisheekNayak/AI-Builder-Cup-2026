from datetime import date
from typing import Literal, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import DEMO_ORG, get_db
from backend.models.business import Task
from backend.services import assistant, gst_preview, inbox, llm, seed, stock
from backend.services.business_common import BusinessError

router = APIRouter()


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessageIn]
    context: Optional[dict] = None


class TaskIn(BaseModel):
    title: str
    detail: Optional[str] = None
    assignee_role: str = "owner"
    due_date: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None


class TaskUpdate(BaseModel):
    status: Literal["open", "done"]


@router.post("/assistant/chat")
async def chat(payload: ChatIn, db: Session = Depends(get_db)):
    return await assistant.chat(db, [m.model_dump() for m in payload.messages], payload.context)


@router.get("/assistant/status")
def assistant_status():
    return llm.status()


@router.get("/inbox/today")
def today(db: Session = Depends(get_db)):
    return inbox.today_inbox(db)


@router.get("/stock")
def stock_overview(db: Session = Depends(get_db)):
    return stock.stock_overview(db)


@router.get("/gst")
def gst_overview(db: Session = Depends(get_db)):
    return gst_preview.gst_overview(db)


@router.get("/tasks")
def list_tasks(status: str = "open", db: Session = Depends(get_db)):
    query = select(Task).where(Task.org_id == DEMO_ORG)
    if status != "all":
        query = query.where(Task.status == status)
    return {"tasks": [inbox.task_view(t) for t in db.scalars(query.order_by(Task.due_date)).all()]}


@router.post("/tasks")
def create_task(payload: TaskIn, db: Session = Depends(get_db)):
    if not payload.title.strip():
        raise BusinessError("Give the task a title.")
    try:
        due = date.fromisoformat(payload.due_date) if payload.due_date else None
    except ValueError:
        raise BusinessError("Enter a valid due date.")
    task = Task(title=payload.title.strip()[:200], detail=payload.detail, assignee_role=payload.assignee_role, due_date=due,
                entity_type=payload.entity_type, entity_id=payload.entity_id)
    db.add(task)
    db.commit()
    return inbox.task_view(task)


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise BusinessError("Task not found.")
    task.status = payload.status
    db.commit()
    return inbox.task_view(task)


@router.post("/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    seed.reset_and_seed(db)
    return {"status": "reset"}
