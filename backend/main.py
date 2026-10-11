import os
from dotenv import load_dotenv
load_dotenv()

import uvicorn
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
from contextlib import asynccontextmanager

PROJECT_ROOT = Path(__file__).parent.parent
os.makedirs(PROJECT_ROOT / "backend" / "data", exist_ok=True)
os.makedirs(PROJECT_ROOT / "backend" / "uploads", exist_ok=True)

logging.basicConfig(level=logging.INFO)

from backend import config, db
from backend.services.business_common import BusinessError
from backend.services.deterministic import load_data
from backend.services.seed import seed_if_empty
from backend.routers import upload, compliance, forms, advisor, company, extraction, orders, receivables, workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_data()
    db.init_db()
    with db.SessionLocal() as session:
        seed_if_empty(session)
    logging.info("ShipSure backend started")
    yield

app = FastAPI(title="ShipSure AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, error: BusinessError):
    return JSONResponse(status_code=400, content={"detail": str(error)})


app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
app.include_router(forms.router, prefix="/api/forms", tags=["forms"])
app.include_router(advisor.router, prefix="/api/advisor", tags=["advisor"])
app.include_router(company.router, prefix="/api/company", tags=["company"])
app.include_router(extraction.router, prefix="/api/extraction", tags=["extraction"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(receivables.router, prefix="/api/receivables", tags=["receivables"])
app.include_router(workspace.router, prefix="/api", tags=["workspace"])

@app.get("/health")
def health_check():
    return {"status": "ok", "demo_mode": os.environ.get("DEMO_MODE", "true")}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
