import os
os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
import vertexai
from vertexai.generative_models import GenerativeModel
vertexai.init(project="project-90c16a2d-d78d-4d57-a9b", location="us-central1")
try:
    model = GenerativeModel("gemini-1.5-pro-preview-0409")
    print(model.generate_content("hi").text)
except Exception as e:
    print("Error 0409:", e)
    
try:
    model = GenerativeModel("gemini-1.5-pro")
    print(model.generate_content("hi").text)
except Exception as e:
    print("Error pro:", e)
