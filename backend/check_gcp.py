import os
from google.cloud import documentai_v1 as documentai
from google.cloud import discoveryengine_v1 as discoveryengine
import google.auth

try:
    credentials, project = google.auth.default()
    project_id = "project-90c16a2d-d78d-4d57-a9b"
    
    print("=== Document AI Processors (us) ===")
    try:
        docai_client = documentai.DocumentProcessorServiceClient()
        parent = f"projects/{project_id}/locations/us"
        request = documentai.ListProcessorsRequest(parent=parent)
        page_result = docai_client.list_processors(request=request)
        for processor in page_result:
            print(f"Name: {processor.display_name}")
            print(f"ID: {processor.name.split('/')[-1]}")
            print(f"Type: {processor.type_}")
            print("---")
    except Exception as e:
        print(f"DocAI Error: {e}")

    print("\n=== Vertex AI Search Datastores (global) ===")
    try:
        discovery_client = discoveryengine.DataStoreServiceClient()
        parent = f"projects/{project_id}/locations/global/collections/default_collection"
        request = discoveryengine.ListDataStoresRequest(parent=parent)
        page_result = discovery_client.list_data_stores(request=request)
        for ds in page_result:
            print(f"Name: {ds.display_name}")
            print(f"ID: {ds.name.split('/')[-1]}")
            print("---")
    except Exception as e:
        print(f"Vertex Search Error: {e}")

except Exception as e:
    print(f"Auth Error: {e}")
