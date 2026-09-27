import os
import google.auth
from google.cloud import documentai_v1 as documentai

try:
    credentials, project = google.auth.default()
    project_id = "project-90c16a2d-d78d-4d57-a9b"
    location = "us"
    
    client = documentai.DocumentProcessorServiceClient()
    parent = f"projects/{project_id}/locations/{location}"
    
    types = client.fetch_processor_types(parent=parent)
    for t in types.processor_types:
        if "INVOICE" in t.type_:
            print(t.type_)
            
except Exception as e:
    print(f"Error: {e}")
