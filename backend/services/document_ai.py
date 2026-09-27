import os
import json
from pathlib import Path
import logging
from backend.models.shipment import ExtractedData, LineItem

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).parent.parent.parent

async def process_document(file_bytes: bytes, filename: str) -> ExtractedData:
    is_gcp_mode = os.environ.get("DEMO_MODE", "true").lower() != "true"
    
    if is_gcp_mode:
        try:
            from google.api_core.client_options import ClientOptions
            from google.cloud import documentai_v1 as documentai
            
            project_id = os.environ.get("GCP_PROJECT_ID")
            location = os.environ.get("GCP_LOCATION", "us")
            processor_id = os.environ.get("GCP_PROCESSOR_ID")
            
            if project_id and processor_id:
                opts = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
                client = documentai.DocumentProcessorServiceClient(client_options=opts)
                name = client.processor_path(project_id, location, processor_id)
                raw_document = documentai.RawDocument(content=file_bytes, mime_type="application/pdf")
                request = documentai.ProcessRequest(name=name, raw_document=raw_document)
                result = client.process_document(request=request)
                
                extracted = ExtractedData()
                for entity in result.document.entities:
                    if entity.type_ == "invoice_id":
                        extracted.invoice_number = entity.mention_text
                    elif entity.type_ == "supplier_name":
                        extracted.seller_name = entity.mention_text
                
                return extracted
        except Exception as e:
            logger.error(f"GCP Document AI error: {e}, falling back to demo mode")
            
    test_data_dir = PROJECT_ROOT / "test-data" / "invoices"
    
    # First, try to parse the uploaded file directly as JSON (for demo uploads of test invoices)
    raw_data = None
    try:
        raw_data = json.loads(file_bytes.decode("utf-8"))
    except Exception:
        pass
    
    # If direct parse failed, load a test invoice based on filename
    if not raw_data:
        json_name = "invoice-clean-pass.json"
        if "scomet" in filename.lower():
            json_name = "invoice-scomet-flag.json"
        elif "fta" in filename.lower():
            json_name = "invoice-fta-eligible.json"
        try:
            with open(test_data_dir / json_name, "r") as f:
                raw_data = json.load(f)
        except Exception as e:
            logger.error(f"Error loading test invoice: {e}")
            return ExtractedData()
    
    try:
        # Handle both field naming conventions
        seller = raw_data.get("seller") or raw_data.get("exporter", {})
        buyer = raw_data.get("buyer") or raw_data.get("consignee", {})
        items_raw = raw_data.get("line_items") or raw_data.get("items", [])
        
        line_items = []
        for item in items_raw:
            line_items.append(LineItem(
                description=item.get("description", ""),
                hs_code=item.get("hs_code"),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                total_value=item.get("total_value") or item.get("fob_value"),
                weight=item.get("weight"),
                unit=item.get("unit") or item.get("uqc"),
            ))
        
        return ExtractedData(
            seller_name=seller.get("name") or seller.get("company_name"),
            seller_address=seller.get("address"),
            seller_country=seller.get("country", "IN"),
            buyer_name=buyer.get("name") or buyer.get("company_name"),
            buyer_address=buyer.get("address"),
            buyer_country=buyer.get("country"),
            port_of_loading=raw_data.get("port_of_loading"),
            port_of_discharge=raw_data.get("port_of_discharge"),
            invoice_number=raw_data.get("invoice_number"),
            invoice_date=raw_data.get("invoice_date"),
            total_value=raw_data.get("total_value") or raw_data.get("total_fob_value"),
            currency=raw_data.get("currency"),
            line_items=line_items,
        )
    except Exception as e:
        logger.error(f"Error parsing invoice data: {e}")
        return ExtractedData()
