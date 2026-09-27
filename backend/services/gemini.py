import os
import json
import logging
from typing import List
from backend.models.shipment import ExtractedData
from backend.models.risk_report import RiskReport, RiskFlag

logger = logging.getLogger(__name__)

async def analyze_compliance(extracted_data: ExtractedData, search_results: List[dict], deterministic_flags: List[dict]) -> RiskReport:
    is_gcp_mode = os.environ.get("DEMO_MODE", "true").lower() != "true"
    
    if is_gcp_mode:
        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel
            
            project_id = os.environ.get("GCP_PROJECT_ID")
            location = "us-central1"
            
            if project_id:
                vertexai.init(project=project_id, location=location)
                model = GenerativeModel("gemini-1.5-pro-preview-0409")
                
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
            logger.error(f"GCP Gemini error: {e}, falling back to demo mode")

    score = "low"
    flags = []
    if deterministic_flags:
        score = "high"
        for f in deterministic_flags:
            flags.append(RiskFlag(
                severity="high",
                title=f.get("data", {}).get("title", "SCOMET Flag"),
                description="This item may require a SCOMET authorization.",
                policy_citation="Appendix 3, SCOMET List",
                recommendation="Apply for SCOMET license via DGFT."
            ))
            
    return RiskReport(
        overall_score=score,
        flags=flags,
        required_forms=["Shipping Bill", "Commercial Invoice"],
        duty_savings=None,
        analysis_summary="Analysis complete based on deterministic rules."
    )

async def advisor_chat(message: str, search_results: List[dict]) -> dict:
    is_gcp_mode = os.environ.get("DEMO_MODE", "true").lower() != "true"
    
    if is_gcp_mode:
        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel
            project_id = os.environ.get("GCP_PROJECT_ID")
            location = "us-central1"
            if project_id:
                vertexai.init(project=project_id, location=location)
                model = GenerativeModel("gemini-1.5-pro-preview-0409")
                
                prompt = f"""
                You are a TradeAdvisor AI.
                Context: {json.dumps(search_results)}
                User Message: {message}
                Respond conversationally and include sources.
                """
                response = model.generate_content(prompt)
                return {"reply": response.text, "sources": [s.get("source") for s in search_results]}
        except Exception as e:
            logger.error(f"GCP Gemini advisor error: {e}, falling back to demo mode")
            
    msg_lower = message.lower()
    reply = ""
    
    if "watches" in msg_lower and "uae" in msg_lower:
        reply = "Yes, you can ship watches to the UAE. Under the **India-UAE CEPA** (Comprehensive Economic Partnership Agreement), watches (HS Chapter 91) typically enjoy significant duty concessions, often dropping to 0%. \n\nEnsure that the *Certificate of Origin* is filed correctly via ICEGATE to claim this preferential tariff."
    elif "scomet" in msg_lower or "8501" in msg_lower:
        reply = "SCOMET regulations govern the export of dual-use goods, including specific electronics and motors under HS 8501. Please verify your exact item specs against **Appendix 3 of the DGFT guidelines**. \n\nIf it falls under Category 5 (Special Materials and Related Equipment), an explicit **End-User Undertaking (EUU)** and DGFT authorization are strictly required before shipping."
    elif "documents" in msg_lower or "needed" in msg_lower:
        reply = "For standard exports from India, you will generally need:\n\n1. Commercial Invoice\n2. Packing List\n3. Shipping Bill (filed via ICEGATE)\n4. Certificate of Origin (for FTA benefits)\n5. Bill of Lading / Airway Bill\n\nAre you shipping to a country with an active FTA (like UAE, Australia, or Japan)?"
    elif "us tariffs" in msg_lower or "auto parts" in msg_lower:
        reply = "Auto parts (HS Chapter 87) exported to the US typically face a standard MFN duty rate ranging from **2.5% to 25%**, depending on the specific component (e.g., brake pads vs. engines). \n\nIndia does not currently have an FTA with the US, so standard MFN rates apply."
    else:
        reply = f"Based on the trade policies retrieved, regarding '{message}', please ensure all ICEGATE filings and HS code classifications are accurate. Let me know if you need specific tariff rates or SCOMET compliance checks."

    return {
        "reply": reply,
        "sources": [s.get("source") for s in search_results] if search_results else ["fta-agreements.json", "common-hs-codes.json"]
    }
