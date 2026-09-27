import json
import os
from pathlib import Path
from typing import Optional, List, Dict

PROJECT_ROOT = Path(__file__).parent.parent.parent
KNOWLEDGE_BASE_DIR = PROJECT_ROOT / "knowledge-base" / "deterministic"

scomet_keywords = {}
common_hs_codes = {}
fta_agreements = {}
indian_ports = {}
shipping_bill_schema = {}

def load_data():
    global scomet_keywords, common_hs_codes, fta_agreements, indian_ports, shipping_bill_schema
    try:
        if (KNOWLEDGE_BASE_DIR / "scomet-keywords.json").exists():
            with open(KNOWLEDGE_BASE_DIR / "scomet-keywords.json", "r") as f:
                scomet_keywords = json.load(f)
        if (KNOWLEDGE_BASE_DIR / "common-hs-codes.json").exists():
            with open(KNOWLEDGE_BASE_DIR / "common-hs-codes.json", "r") as f:
                common_hs_codes = json.load(f)
        if (KNOWLEDGE_BASE_DIR / "fta-agreements.json").exists():
            with open(KNOWLEDGE_BASE_DIR / "fta-agreements.json", "r") as f:
                fta_agreements = json.load(f)
        if (KNOWLEDGE_BASE_DIR / "indian-ports.json").exists():
            with open(KNOWLEDGE_BASE_DIR / "indian-ports.json", "r") as f:
                indian_ports = json.load(f)
        if (KNOWLEDGE_BASE_DIR / "shipping-bill-schema.json").exists():
            with open(KNOWLEDGE_BASE_DIR / "shipping-bill-schema.json", "r") as f:
                shipping_bill_schema = json.load(f)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error loading deterministic data: {e}")

load_data()

def check_scomet(hs_code: Optional[str], description: Optional[str]) -> Optional[dict]:
    if not scomet_keywords: return None
    categories = scomet_keywords.get("categories", [])
    
    if hs_code:
        for cat_data in categories:
            for prefix in cat_data.get("hs_code_prefixes", []):
                if hs_code.startswith(prefix):
                    return {"category": cat_data.get("id", "unknown"), "data": cat_data}
                    
    if description:
        desc_lower = description.lower()
        for cat_data in categories:
            for kw in cat_data.get("keywords", []):
                if kw.lower() in desc_lower:
                    return {"category": cat_data.get("id", "unknown"), "data": cat_data}
    return None

def lookup_hs_code(hs_code: str) -> Optional[dict]:
    return common_hs_codes.get(hs_code)

def check_fta_eligibility(destination_country: str) -> List[dict]:
    matches = []
    if not destination_country: return matches
    dest_upper = destination_country.upper()
    dest_lower = destination_country.lower()
    # fta_agreements can be a list directly or a dict with "agreements" key
    agreements = fta_agreements if isinstance(fta_agreements, list) else fta_agreements.get("agreements", [])
    for agreement in agreements:
        partner_codes = [c.upper() for c in agreement.get("partner_countries", [])]
        if dest_upper in partner_codes or dest_lower in [c.lower() for c in agreement.get("partner_countries", [])]:
            matches.append(agreement)
    return matches

def lookup_port(port_code: str) -> Optional[dict]:
    return indian_ports.get(port_code)

def get_shipping_bill_schema() -> dict:
    return shipping_bill_schema
