"""Turn a customer PO (PDF/image) into a draft order for human review. Nothing is saved here."""
import io
import re
from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import DEMO_ORG
from backend.models.business import Customer, Item
from backend.services import llm
from backend.services.orders import customer_mentioned

GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b")
DATE_PATTERN = r"(\d{1,2}[-/.\s][A-Za-z]{3,9}[-/.\s]\d{2,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})"
PO_PROMPT = """This is a customer purchase order sent to an Indian manufacturer. Extract JSON with exactly these keys:
customer_name (the company issuing the PO), customer_gstin, po_number, po_date (YYYY-MM-DD), promised_date (delivery/required date, YYYY-MM-DD),
lines: [{item_code, description, qty (number), unit, rate (number, per unit, before tax)}],
low_confidence: [list of keys above you are unsure about, e.g. "promised_date" or "lines.0.rate"].
Use null for anything not printed. Do not guess."""


class CaptureError(RuntimeError):
    pass


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    value = re.sub(r"\s+", " ", value.strip().replace(".", "-").replace("/", "-"))
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y", "%d-%b-%Y", "%d-%B-%Y", "%d %b %Y", "%d %B %Y", "%d-%b-%y", "%d %b %y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _match_customer(db: Session, name: str | None, gstin: str | None) -> Customer | None:
    customers = db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG)).all()
    if gstin:
        for c in customers:
            if c.gstin and c.gstin.upper() == gstin.upper():
                return c
    if name:
        lower = name.lower()
        for c in customers:
            if c.name.lower() == lower or customer_mentioned(c.name, lower):
                return c
    return None


def _match_item(items: list[Item], code: str | None, description: str | None) -> Item | None:
    if code:
        for item in items:
            if item.code.upper() == code.upper():
                return item
    if description:
        words = {w for w in re.findall(r"[a-z0-9]+", description.lower()) if len(w) > 2}
        best, best_score = None, 0
        for item in items:
            score = len(words & set(re.findall(r"[a-z0-9]+", item.name.lower())))
            if score > best_score:
                best, best_score = item, score
        if best_score >= 2:
            return best
    return None


def _rules_extract(file_bytes: bytes, db: Session) -> dict:
    try:
        from pypdf import PdfReader
        text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(file_bytes)).pages)
    except Exception as error:
        raise CaptureError("This PDF could not be read. Enter the order manually.") from error
    if len(text.strip()) < 20:
        raise CaptureError("This PDF has no readable text (it may be a scan). AI reading is unavailable right now, so enter the order manually.")

    def find(pattern: str) -> str | None:
        m = re.search(pattern, text, re.I)
        return m.group(1).strip() if m else None

    gstins = GSTIN_RE.findall(text)
    customers = db.scalars(select(Customer).where(Customer.org_id == DEMO_ORG)).all()
    customer = next((c for g in gstins for c in customers if c.gstin == g), None) or \
        next((c for c in customers if c.name.lower() in text.lower()), None)
    buyer_name = customer.name if customer else find(r"(?:Buyer|Issued by|From)\s*[:\-]\s*([^\n]+)")
    data = {
        "customer_name": buyer_name,
        "customer_gstin": customer.gstin if customer else (gstins[0] if gstins else None),
        "po_number": find(r"(?:P\.?\s?O\.?|Purchase\s+Order)\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-]+)"),
        "po_date": _parse_date(find(r"(?:PO|Order)\s*Date\s*[:\-]?\s*" + DATE_PATTERN)),
        "promised_date": _parse_date(find(r"(?:Delivery|Required|Due|Schedule)\s*(?:Date|By)?\s*[:\-]?\s*" + DATE_PATTERN)),
        "lines": [],
        "low_confidence": [],
    }
    items = db.scalars(select(Item).where(Item.org_id == DEMO_ORG)).all()
    rows = [r.strip() for r in text.splitlines() if r.strip()]
    code_at = {}
    for idx, row in enumerate(rows):
        item = next((i for i in items if re.search(rf"(?<![A-Za-z0-9-]){re.escape(i.code)}(?![A-Za-z0-9-])", row, re.I)), None)
        if item:
            code_at[idx] = item
    starts = sorted(code_at)
    for pos, idx in enumerate(starts):
        item = code_at[idx]
        # Table cells may be on one line or one per line; read until the next item code or the totals row.
        end = starts[pos + 1] if pos + 1 < len(starts) else len(rows)
        segment = [rows[idx].split(item.code, 1)[-1]] + rows[idx + 1:end]
        segment = [s for s in segment if not re.search(r"\btotal\b", s, re.I)][:8]
        numbers = [float(n.replace(",", "")) for s in segment
                   for n in re.findall(r"(?<![A-Za-z0-9-])(\d[\d,]*(?:\.\d+)?)(?![A-Za-z0-9-])", s)]
        numbers = [n for n in numbers if n > 0]
        if not numbers:
            continue
        data["lines"].append({"item_code": item.code, "description": item.name, "qty": numbers[0],
                              "rate": numbers[1] if len(numbers) > 1 else None, "unit": item.unit})
    data["low_confidence"] = [k for k in ("customer_name", "po_number", "po_date", "promised_date") if not data[k]]
    if not customer:
        data["low_confidence"].append("customer_name")
    if not data["lines"]:
        data["low_confidence"].append("lines")
    return data


async def capture_po(db: Session, file_bytes: bytes, filename: str, mime_type: str) -> dict:
    mode = "ai"
    if llm.enabled():
        try:
            raw = await llm.extract_document(file_bytes, mime_type, PO_PROMPT)
        except llm.LLMUnavailable:
            raw = None
    else:
        raw = None
    if raw is None:
        if mime_type != "application/pdf":
            raise CaptureError("AI reading is unavailable right now, so photos can't be read. Upload the PO as a PDF or enter it manually.")
        raw = _rules_extract(file_bytes, db)
        mode = "rules"

    customer = _match_customer(db, raw.get("customer_name"), raw.get("customer_gstin"))
    items = db.scalars(select(Item).where(Item.org_id == DEMO_ORG)).all()
    lines = []
    low = set(raw.get("low_confidence") or [])
    for idx, line in enumerate(raw.get("lines") or []):
        item = _match_item(items, line.get("item_code"), line.get("description"))
        rate = line.get("rate")
        if rate in (None, "") and item:
            rate = item.rate
            low.add(f"lines.{idx}.rate")
        if not item:
            low.add(f"lines.{idx}.item")
        lines.append({"item_id": item.id if item else None, "item_code": item.code if item else line.get("item_code"),
                      "description": item.name if item else (line.get("description") or ""),
                      "qty": line.get("qty"), "rate": rate, "unit": line.get("unit") or (item.unit if item else None)})
    if not customer:
        low.add("customer_name")
    po_date = _parse_date(raw.get("po_date")) or raw.get("po_date")
    promised = _parse_date(raw.get("promised_date")) or raw.get("promised_date")
    if not po_date:
        po_date = date.today().isoformat()
        low.add("po_date")
    return {
        "mode": mode, "filename": filename,
        "customer_id": customer.id if customer else None,
        "customer_name": customer.name if customer else raw.get("customer_name"),
        "customer_gstin": raw.get("customer_gstin"), "new_customer": customer is None and bool(raw.get("customer_name")),
        "po_number": raw.get("po_number"), "po_date": po_date, "promised_date": promised,
        "lines": lines, "low_confidence": sorted(low),
    }
