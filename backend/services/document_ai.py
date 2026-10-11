import json
import logging
import os
from pathlib import Path
from backend.models.shipment import ExtractedData, LineItem
from backend.services import llm

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).parent.parent.parent
SAMPLE_INVOICES = {
    "clean-pass": "invoice-clean-pass.json",
    "fta-eligible": "invoice-fta-eligible.json",
    "scomet-flag": "invoice-scomet-flag.json",
}
MIME_TYPES = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

INVOICE_PROMPT = """Extract this export commercial invoice as JSON with exactly these keys:
seller_name, seller_address, seller_country (ISO-2), buyer_name, buyer_address, buyer_country (ISO-2),
port_of_loading, port_of_discharge, invoice_number, invoice_date (YYYY-MM-DD), currency (ISO), total_value (number),
payment_terms, line_items: [{description, hs_code (digits only), quantity (number), unit, unit_price (number), total_value (number), weight (number, kg)}].
Use null for anything not printed on the document. Do not guess."""


class ExtractionError(RuntimeError):
    pass


def mime_type_for(filename: str) -> str | None:
    return MIME_TYPES.get(Path(filename).suffix.lower())


def parse_invoice_json(raw_data: dict) -> ExtractedData:
    """Map structured invoice JSON (our sample format, or ERP exports in the same shape) to ExtractedData."""
    seller = raw_data.get("seller") or raw_data.get("exporter") or {}
    buyer = raw_data.get("buyer") or raw_data.get("consignee") or {}
    items_raw = raw_data.get("line_items") or raw_data.get("items") or []
    line_items = [LineItem(
        description=item.get("description", ""),
        hs_code=item.get("hs_code"),
        quantity=item.get("quantity"),
        unit_price=item.get("unit_price"),
        total_value=item.get("total_value") or item.get("fob_value"),
        weight=item.get("weight") or item.get("net_weight"),
        unit=item.get("unit") or item.get("uqc"),
    ) for item in items_raw]
    return ExtractedData(
        seller_name=seller.get("name") or seller.get("company_name") or raw_data.get("seller_name"),
        seller_address=seller.get("address") or raw_data.get("seller_address"),
        seller_country=seller.get("country") or raw_data.get("seller_country") or "IN",
        buyer_name=buyer.get("name") or buyer.get("company_name") or raw_data.get("buyer_name"),
        buyer_address=buyer.get("address") or raw_data.get("buyer_address"),
        buyer_country=buyer.get("country") or raw_data.get("buyer_country"),
        port_of_loading=raw_data.get("port_of_loading"),
        port_of_discharge=raw_data.get("port_of_discharge"),
        invoice_number=raw_data.get("invoice_number"),
        invoice_date=raw_data.get("invoice_date"),
        total_value=raw_data.get("total_value") or raw_data.get("total_fob_value"),
        currency=raw_data.get("currency"),
        payment_terms=raw_data.get("payment_terms"),
        line_items=line_items,
    )


def load_sample(name: str) -> tuple[bytes, str]:
    filename = SAMPLE_INVOICES.get(name)
    if not filename:
        raise ExtractionError("Unknown sample invoice.")
    return (PROJECT_ROOT / "test-data" / "invoices" / filename).read_bytes(), filename


def _document_ai(file_bytes: bytes, mime_type: str) -> ExtractedData | None:
    project_id = os.environ.get("GCP_PROJECT_ID")
    processor_id = os.environ.get("GCP_PROCESSOR_ID")
    if os.environ.get("DEMO_MODE", "true").lower() == "true" or not (project_id and processor_id):
        return None
    from google.api_core.client_options import ClientOptions
    from google.cloud import documentai_v1 as documentai
    location = os.environ.get("GCP_DOCAI_LOCATION", "us")
    client = documentai.DocumentProcessorServiceClient(client_options=ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com"))
    result = client.process_document(request=documentai.ProcessRequest(
        name=client.processor_path(project_id, location, processor_id),
        raw_document=documentai.RawDocument(content=file_bytes, mime_type=mime_type)))
    fields: dict = {}
    items: list[LineItem] = []
    mapping = {"invoice_id": "invoice_number", "invoice_date": "invoice_date", "supplier_name": "seller_name",
               "supplier_address": "seller_address", "receiver_name": "buyer_name", "receiver_address": "buyer_address",
               "ship_to_name": "buyer_name", "currency": "currency", "payment_terms": "payment_terms"}
    for entity in result.document.entities:
        key = mapping.get(entity.type_)
        if key and key not in fields:
            fields[key] = entity.mention_text.strip()
        elif entity.type_ == "total_amount":
            try:
                fields["total_value"] = float(entity.normalized_value.text or entity.mention_text.replace(",", ""))
            except ValueError:
                pass
        elif entity.type_ == "line_item":
            props = {p.type_.split("/")[-1]: p.mention_text for p in entity.properties}
            def num(v):
                try:
                    return float(str(v).replace(",", "")) if v else None
                except ValueError:
                    return None
            items.append(LineItem(description=props.get("description", entity.mention_text), quantity=num(props.get("quantity")),
                                  unit_price=num(props.get("unit_price")), total_value=num(props.get("amount")),
                                  hs_code=props.get("product_code")))
    return ExtractedData(**fields, line_items=items)


async def process_document(file_bytes: bytes, filename: str) -> ExtractedData:
    """Extract invoice data. Raises ExtractionError when the document can't be read; never substitutes sample data."""
    if filename.lower().endswith(".json"):
        try:
            return parse_invoice_json(json.loads(file_bytes.decode("utf-8")))
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError) as error:
            raise ExtractionError("This JSON file is not a readable invoice.") from error

    mime_type = mime_type_for(filename)
    if not mime_type:
        raise ExtractionError("Upload a PDF, PNG, JPG or JSON invoice.")
    try:
        extracted = _document_ai(file_bytes, mime_type)
        if extracted and (extracted.buyer_name or extracted.line_items):
            return extracted
    except Exception as error:
        logger.error("Document AI error: %s", error)

    if not llm.enabled():
        raise ExtractionError("AI extraction is unavailable right now, so this invoice can't be read automatically. "
                              "Try a sample invoice, or upload the invoice as JSON.")
    try:
        data = await llm.extract_document(file_bytes, mime_type, INVOICE_PROMPT)
    except llm.LLMUnavailable as error:
        raise ExtractionError(f"AI extraction failed: {error}") from error
    extracted = ExtractedData(**{k: v for k, v in data.items() if k in ExtractedData.model_fields and k != "line_items"},
                              line_items=[LineItem(**{k: v for k, v in li.items() if k in LineItem.model_fields})
                                          for li in data.get("line_items") or [] if li.get("description")])
    if not (extracted.buyer_name or extracted.line_items):
        raise ExtractionError("No invoice details were found in this document. Check that it is a commercial invoice.")
    return extracted
