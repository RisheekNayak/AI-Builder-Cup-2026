import os
from google.cloud import discoveryengine_v1 as discoveryengine
project_id = "project-90c16a2d-d78d-4d57-a9b"
datastore_id = "shipsure-docs_1790522145143"
location = "global"
client = discoveryengine.SearchServiceClient()
serving_config = client.serving_config_path(project=project_id, location=location, data_store=datastore_id, serving_config="default_config")
request = discoveryengine.SearchRequest(serving_config=serving_config, query="watches")
try:
    print("Searching...")
    response = client.search(request)
    for r in response.results:
        print(r.document.derived_struct_data.get("link"))
except Exception as e:
    print("Error:", e)
