import os
from dotenv import load_dotenv

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-project-id")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
DOCUMENT_AI_PROCESSOR_ID = os.getenv("DOCUMENT_AI_PROCESSOR_ID", "your-processor-id")
VERTEX_SEARCH_DATASTORE_ID = os.getenv("VERTEX_SEARCH_DATASTORE_ID", "your-datastore-id")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "your-bucket-name")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost/dbname")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-pro")
