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
            
    return local_search(query, top_k)


STOPWORDS = {"the", "a", "an", "of", "to", "for", "from", "in", "on", "and", "or", "is", "are", "what", "which", "how", "do",
             "does", "i", "my", "we", "our", "export", "india", "items", "need", "with", "by", "can", "it", "this", "that"}


def _records(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return value
        return [data]
    return []


def local_search(query: str, top_k: int = 5) -> List[dict]:
    """Offline retrieval over the knowledge-base JSON: returns the matching records themselves as passages."""
    import json
    import re
    terms = [t for t in re.findall(r"[a-z0-9]+", query.lower()) if t not in STOPWORDS and len(t) > 1]
    results = []
    for file_path in (PROJECT_ROOT / "knowledge-base" / "deterministic").glob("*.json"):
        try:
            records = _records(json.loads(file_path.read_text()))
        except (OSError, ValueError):
            continue
        for record in records:
            text = json.dumps(record, ensure_ascii=False)
            lower = text.lower()
            score = sum(1 for t in terms if re.search(rf"\b{re.escape(t)}\b", lower))
            if score:
                title = record.get("name") or record.get("description") or record.get("id") if isinstance(record, dict) else None
                results.append({"title": f"{title} ({file_path.stem})" if title else file_path.stem,
                                "content": text[:600], "source": file_path.name, "relevance_score": float(score)})
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:top_k]
