import os
import json
import logging
from typing import List
from backend.models.shipment import ExtractedData
from backend.models.risk_report import RiskReport, RiskFlag

logger = logging.getLogger(__name__)

async def analyze_compliance(extracted_data: ExtractedData, search_results: List[dict], deterministic_flags: List[dict]) -> RiskReport:
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        
        project_id = os.environ.get("GCP_PROJECT_ID", "project-90c16a2d-d78d-4d57-a9b")
        location = "us-central1"
        
        vertexai.init(project=project_id, location=location)
        model = GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are an expert Indian export compliance AI.
        Analyze the following shipment:
        Data: {extracted_data.model_dump_json()}
        Search Context: {json.dumps(search_results)}
        Deterministic Flags: {json.dumps(deterministic_flags)}
        
        Return a JSON object conforming to this schema (do NOT use markdown blocks, just raw JSON):
        {{
          "overall_score": "low|medium|high|critical",
          "flags": [
            {{"severity": "low|medium|high|critical", "title": "string", "description": "string", "policy_citation": "string", "recommendation": "string"}}
          ],
          "required_forms": ["string"],
          "duty_savings": "string",
          "analysis_summary": "string"
        }}
        """
        
        response = model.generate_content(prompt)
        resp_text = response.text.strip()
        if resp_text.startswith("```json"):
            resp_text = resp_text[7:-3]
        elif resp_text.startswith("```"):
            resp_text = resp_text[3:-3]
            
        data = json.loads(resp_text)
        return RiskReport(**data)
    except Exception as e:
        logger.error(f"GCP Gemini error: {e}")
        return RiskReport(
            overall_score="high",
            flags=[RiskFlag(severity="high", title="API Error", description=str(e), policy_citation="N/A", recommendation="Check API")],
            required_forms=[],
            analysis_summary="Backend AI failed."
        )

async def advisor_chat(message: str, search_results: List[dict]) -> dict:
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        
        project_id = os.environ.get("GCP_PROJECT_ID", "project-90c16a2d-d78d-4d57-a9b")
        location = "us-central1"
        
        vertexai.init(project=project_id, location=location)
        model = GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are a TradeAdvisor AI.
        Context: {json.dumps(search_results)}
        User Message: {message}
        Respond conversationally and include sources if relevant.
        """
        response = model.generate_content(prompt)
        return {
            "reply": response.text, 
            "sources": [s.get("source") for s in search_results] if search_results else []
        }
    except Exception as e:
        logger.error(f"GCP Gemini advisor error: {e}")
        return {
            "reply": f"API Error: {str(e)}",
            "sources": []
        }
