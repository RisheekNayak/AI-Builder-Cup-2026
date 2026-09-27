import os
import vertexai
from vertexai.generative_models import GenerativeModel
os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
models = ["gemini-1.5-pro", "gemini-1.5-flash"]
regions = ["us-central1", "us-east4", "us-east1", "us-west1", "europe-west4"]
for r in regions:
    print("Testing region:", r)
    vertexai.init(project="project-90c16a2d-d78d-4d57-a9b", location=r)
    for m in models:
        try:
            model = GenerativeModel(m)
            print(f"  {m}:", model.generate_content("hi").text)
        except Exception as e:
            print(f"  Error {m}:", e)
