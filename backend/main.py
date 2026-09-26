from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, extraction, compliance, forms, advisor, company

app = FastAPI(title="ShipSure API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(extraction.router, prefix="/api/v1/extraction", tags=["Extraction"])
app.include_router(compliance.router, prefix="/api/v1/compliance", tags=["Compliance"])
app.include_router(forms.router, prefix="/api/v1/forms", tags=["Forms"])
app.include_router(advisor.router, prefix="/api/v1/advisor", tags=["Advisor"])
app.include_router(company.router, prefix="/api/v1/company", tags=["Company"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
