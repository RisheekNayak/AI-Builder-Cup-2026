import os
import google.auth
from google.cloud import documentai_v1 as documentai

try:
    credentials, project = google.auth.default()
    project_id = "project-90c16a2d-d78d-4d57-a9b"
    location = "us"
    
    client = documentai.DocumentProcessorServiceClient()
    parent = f"projects/{project_id}/locations/{location}"
    
    print("Creating Invoice Parser Processor...")
    processor = documentai.Processor(
        display_name="shipsure-invoice-parser",
        type_="INVOICE_PROCESSOR"
    )
    
    new_processor = client.create_processor(
        parent=parent,
        processor=processor
    )
    
    proc_id = new_processor.name.split('/')[-1]
    print(f"SUCCESS! Processor ID: {proc_id}")
    
    # Save to .env
    with open(".env", "a") as f:
        f.write(f"\nGCP_PROCESSOR_ID={proc_id}\n")
        
except Exception as e:
    print(f"Error: {e}")
