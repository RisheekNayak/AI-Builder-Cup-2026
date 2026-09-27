from google import genai
import os

os.environ["GCP_PROJECT_ID"] = "project-90c16a2d-d78d-4d57-a9b"
try:
    client = genai.Client(vertexai=True, project="project-90c16a2d-d78d-4d57-a9b", location="us-central1")
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Hi there!'
    )
    print("SUCCESS: ", response.text)
except Exception as e:
    print("ERROR: ", e)
