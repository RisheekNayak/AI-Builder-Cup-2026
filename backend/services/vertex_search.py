import os
import logging
from typing import List
from pathlib import Path

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).parent.parent.parent

async def search(query: str, top_k: int = 5) -> List[dict]:
    is_gcp_mode = os.environ.get("DEMO_MODE", "true").lower() != "true"
    
    if is_gcp_mode:
        try:
            from google.cloud import discoveryengine_v1 as discoveryengine
            
            project_id = os.environ.get("GCP_PROJECT_ID")
            location = "global"
            datastore_id = os.environ.get("GCP_DATASTORE_ID")
            
            if project_id and datastore_id:
                client = discoveryengine.SearchServiceClient()
                serving_config = client.serving_config_path(
                    project=project_id, location=location, data_store=datastore_id, serving_config="default_config"
                )
                request = discoveryengine.SearchRequest(
                    serving_config=serving_config,
                    query=query,
                    page_size=top_k,
                )
                response = client.search(request)
                
                results = []
                for result in response.results:
                    results.append({
                        "content": result.document.derived_struct_data.get("snippets", [{}])[0].get("snippet", ""),
                        "source": result.document.derived_struct_data.get("link", ""),
                        "relevance_score": result.relevance_score
                    })
                return results
        except Exception as e:
            logger.error(f"GCP Vertex Search error: {e}, falling back to demo mode")
            
    kb_dir = PROJECT_ROOT / "knowledge-base" / "deterministic"
    results = []
    query_terms = query.lower().split()
    
    if kb_dir.exists():
        for file_path in kb_dir.glob("*.json"):
            try:
                with open(file_path, "r") as f:
                    content_str = f.read()
                    score = sum(1 for term in query_terms if term in content_str.lower())
                    if score > 0:
                        results.append({
                            "content": f"Match found in {file_path.name}. Score: {score}",
                            "source": file_path.name,
                            "relevance_score": float(score)
                        })
            except Exception as e:
                pass
            
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:top_k]
