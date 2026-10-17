import logging
from backend.models.shipment import ExtractedData
from backend.services.deterministic import check_scomet, check_fta_eligibility
from backend.services.vertex_search import search
from backend.services.gemini import analyze_compliance

logger = logging.getLogger(__name__)


async def analyze_extracted(extracted_data: ExtractedData) -> dict:
    """Run deterministic checks, retrieve policy context and produce the risk report for already-extracted data."""
    scomet_flags = []
    for item in extracted_data.line_items:
        res = check_scomet(item.hs_code, item.description)
        if res:
            scomet_flags.append({**res, "item": item.description})
    fta_matches = check_fta_eligibility(extracted_data.buyer_country) if extracted_data.buyer_country else []

    query = f"Export from India to {extracted_data.buyer_country or 'unknown country'}"
    if extracted_data.line_items:
        query += f" items: {', '.join(it.description for it in extracted_data.line_items)}"
    search_results = await search(query)

    risk_report = await analyze_compliance(extracted_data, search_results, scomet_flags, fta_matches)
    return {
        "extracted_data": extracted_data,
        "risk_report": risk_report,
        "fta_matches": [{k: a.get(k) for k in ("name", "partner_countries", "origin_criteria", "certificate_form_name", "key_benefits")}
                        for a in fta_matches],
        "scomet_flags": [{"category": f.get("category"), "item": f.get("item"), "name": f.get("data", {}).get("name")} for f in scomet_flags],
    }
