import os
import vertexai
from vertexai.generative_models import GenerativeModel

os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
project_id = "project-90c16a2d-d78d-4d57-a9b"
location = "us-central1"

try:
    vertexai.init(project=project_id, location=location)
    model = GenerativeModel("gemini-3.8-flash")
    print("Testing gemini-3.8-flash...")
    response = model.generate_content("Hello, world!")
    print("SUCCESS:", response.text)
except Exception as e:
    print("ERROR:", e)
