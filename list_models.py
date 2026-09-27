from google import genai
import os

os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
try:
    client = genai.Client(vertexai=True, project="project-90c16a2d-d78d-4d57-a9b", location="us-central1")
    models = client.models.list()
    print("Available Models:")
    for m in models:
        print(f"- {m.name}")
except Exception as e:
    print("ERROR:", e)
