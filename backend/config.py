import os
from dotenv import load_dotenv

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "project-90c16a2d-d78d-4d57-a9b")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
DOCUMENT_AI_PROCESSOR_ID = os.getenv("DOCUMENT_AI_PROCESSOR_ID", "your-processor-id")
VERTEX_SEARCH_DATASTORE_ID = os.getenv("VERTEX_SEARCH_DATASTORE_ID", "your-datastore-id")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "your-bucket-name")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
GEMINI_LOCATION = os.getenv("GEMINI_LOCATION", "us-central1")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
