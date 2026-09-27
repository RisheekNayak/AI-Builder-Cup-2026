import io
from typing import Optional
from backend.models.shipment import ExtractedData
from backend.models.company import CompanyProfile
from backend.models.risk_report import RiskReport

def generate_shipping_bill(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], risk_report: Optional[RiskReport]) -> bytes:
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        c.drawString(100, 800, "SHIPSURE - SHIPPING BILL")
        c.drawString(100, 780, f"Invoice Number: {extracted_data.invoice_number}")
        
        if company_profile:
            c.drawString(100, 760, f"Exporter: {company_profile.name}")
            c.drawString(100, 740, f"IEC: {company_profile.iec_code}")
            
        c.drawString(100, 720, f"Buyer: {extracted_data.buyer_name}")
        c.drawString(100, 700, f"Destination: {extracted_data.buyer_country}")
        
        y = 660
        c.drawString(100, 680, "Line Items:")
        for idx, item in enumerate(extracted_data.line_items):
            c.drawString(120, y, f"{idx+1}. {item.description} - HS: {item.hs_code} - Qty: {item.quantity}")
            y -= 20
            
        c.showPage()
        c.save()
        return buffer.getvalue()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"PDF generation error: {e}")
        return b"PDF Generation Error"

def generate_certificate_of_origin(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], fta_info: list) -> bytes:
    try:
        from reportlab.pdfgen import canvas
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer)
        c.drawString(100, 800, "CERTIFICATE OF ORIGIN")
        if company_profile:
            c.drawString(100, 780, f"Exporter: {company_profile.name}")
        c.drawString(100, 760, f"Consignee: {extracted_data.buyer_name}")
        c.showPage()
        c.save()
        return buffer.getvalue()
    except Exception:
        return b""

def generate_end_user_undertaking(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], scomet_flags: list) -> bytes:
    try:
        from reportlab.pdfgen import canvas
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer)
        c.drawString(100, 800, "END USER UNDERTAKING (SCOMET)")
        if company_profile:
            c.drawString(100, 780, f"Exporter: {company_profile.name}")
        c.drawString(100, 760, f"Consignee: {extracted_data.buyer_name}")
        c.showPage()
        c.save()
        return buffer.getvalue()
    except Exception:
        return b""
