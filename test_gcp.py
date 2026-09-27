import os, asyncio
os.environ["DEMO_MODE"] = "false"
os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
os.environ["GCP_DATASTORE_ID"] = "shipsure-docs_1790522145143"
from backend.services.gemini import advisor_chat
print(asyncio.run(advisor_chat("test", [])))
