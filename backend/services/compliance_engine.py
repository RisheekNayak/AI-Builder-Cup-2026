import logging
from typing import Optional
from backend.models.company import CompanyProfile
from backend.services.document_ai import process_document
from backend.services.deterministic import check_scomet, check_fta_eligibility
from backend.services.vertex_search import search
from backend.services.gemini import analyze_compliance

logger = logging.getLogger(__name__)

async def analyze_shipment(file_bytes: bytes, filename: str, company_profile: Optional[CompanyProfile] = None) -> dict:
    try:
        extracted_data = await process_document(file_bytes, filename)
        
        scomet_flags = []
        for item in extracted_data.line_items:
            res = check_scomet(item.hs_code, item.description)
            if res:
                scomet_flags.append(res)
                
        fta_matches = []
        if extracted_data.buyer_country:
            fta_matches = check_fta_eligibility(extracted_data.buyer_country)
            
        query = f"Export from India to {extracted_data.buyer_country}"
        if extracted_data.line_items:
            query += f" items: {', '.join([it.description for it in extracted_data.line_items])}"
        search_results = await search(query)
        
        risk_report = await analyze_compliance(extracted_data, search_results, scomet_flags)
        
        return {
            "extracted_data": extracted_data,
            "risk_report": risk_report,
            "fta_matches": fta_matches,
            "scomet_flags": scomet_flags
        }
    except Exception as e:
        logger.error(f"Analysis engine error: {e}")
        raise e
