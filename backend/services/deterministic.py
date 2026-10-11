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

def _records(data, key: str) -> list:
    """Knowledge-base files are either a list or a dict wrapping a list."""
    if isinstance(data, list):
        return data
    return data.get(key, []) if isinstance(data, dict) else []

def lookup_hs_code(hs_code: str) -> Optional[dict]:
    if not hs_code:
        return None
    code = hs_code.replace(".", "").strip()
    for record in _records(common_hs_codes, "hs_codes"):
        if record.get("hs_code") == code:
            return record
    return None

COUNTRY_ALIASES = {
    "AE": ["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"],
    "US": ["usa", "united states", "united states of america", "america"],
    "GB": ["uk", "united kingdom", "britain", "great britain", "england"],
    "DE": ["germany"], "FR": ["france"], "IT": ["italy"], "NL": ["netherlands", "holland"],
    "AU": ["australia"], "JP": ["japan"], "KR": ["south korea", "korea"], "SG": ["singapore"],
    "MY": ["malaysia"], "TH": ["thailand"], "VN": ["vietnam"], "ID": ["indonesia"], "PH": ["philippines"],
    "LK": ["sri lanka"], "BD": ["bangladesh"], "NP": ["nepal"], "MU": ["mauritius"], "SA": ["saudi arabia", "saudi", "ksa"],
    "CN": ["china"], "CH": ["switzerland"], "NO": ["norway"], "IS": ["iceland"], "LI": ["liechtenstein"],
    "CA": ["canada"], "MX": ["mexico"], "BR": ["brazil"], "ZA": ["south africa"], "OM": ["oman"], "QA": ["qatar"],
}

def country_code(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = value.strip().lower().rstrip(".")
    if len(text) == 2 and text.isalpha():
        return text.upper()
    for code, names in COUNTRY_ALIASES.items():
        if text in names:
            return code
    return None

def countries_in_text(text: str) -> List[str]:
    """Country codes mentioned in free text, by name/alias or an upper-case ISO code like 'AE'."""
    import re
    lower = text.lower()
    found = [code for code, names in COUNTRY_ALIASES.items() if any(re.search(rf"\b{re.escape(n)}\b", lower) for n in names)]
    found += [t for t in re.findall(r"\b[A-Z]{2}\b", text) if t in COUNTRY_ALIASES and t not in found]
    return found

def check_fta_eligibility(destination_country: str) -> List[dict]:
    code = country_code(destination_country)
    if not code:
        return []
    return [a for a in _records(fta_agreements, "agreements") if code in [c.upper() for c in a.get("partner_countries", [])]]

def lookup_port(port_code: str) -> Optional[dict]:
    if not port_code:
        return None
    code = port_code.strip().upper()
    for record in _records(indian_ports, "ports"):
        if record.get("code", "").upper() == code:
            return record
    return None

def get_shipping_bill_schema() -> dict:
    return shipping_bill_schema
