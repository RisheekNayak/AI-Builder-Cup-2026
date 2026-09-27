import io
from typing import Optional
from backend.models.shipment import ExtractedData
from backend.models.company import CompanyProfile
from backend.models.risk_report import RiskReport
import logging

logger = logging.getLogger(__name__)

def generate_shipping_bill(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], risk_report: Optional[RiskReport]) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        styles = getSampleStyleSheet()

        # Custom Styles
        header_style = ParagraphStyle('Header', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, alignment=1, spaceAfter=10)
        sub_header = ParagraphStyle('SubHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, alignment=1, spaceAfter=20)
        table_header_style = ParagraphStyle('TableHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=colors.whitesmoke)
        normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=8)

        # Title
        elements.append(Paragraph("GOVERNMENT OF INDIA", header_style))
        elements.append(Paragraph("CENTRAL BOARD OF INDIRECT TAXES AND CUSTOMS", sub_header))
        elements.append(Paragraph("SHIPPING BILL FOR EXPORT OF GOODS", header_style))
        
        elements.append(Spacer(1, 0.2*inch))

        # Top Information Grid
        exp_name = company_profile.name if company_profile else "Not Provided"
        exp_iec = company_profile.iec_code if company_profile else "Not Provided"
        exp_ad = company_profile.ad_code if company_profile else "Not Provided"
        
        top_data = [
            ["SB No:", f"SB-{extracted_data.invoice_number or 'PENDING'}", "SB Date:", "Auto-Generated"],
            ["Port of Loading:", extracted_data.port_of_loading or "Not Specified", "Port of Discharge:", extracted_data.port_of_discharge or "Not Specified"],
            ["IEC Code:", exp_iec, "AD Code:", exp_ad]
        ]
        
        t1 = Table(top_data, colWidths=[1.2*inch, 2.5*inch, 1.2*inch, 2.5*inch])
        t1.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(t1)
        elements.append(Spacer(1, 0.2*inch))

        # Party Details Grid
        party_data = [
            [Paragraph("<b>EXPORTER DETAILS</b>", normal_style), Paragraph("<b>CONSIGNEE DETAILS</b>", normal_style)],
            [Paragraph(f"{exp_name}<br/>{company_profile.factory_address if company_profile else ''}<br/>India", normal_style),
             Paragraph(f"{extracted_data.buyer_name or 'N/A'}<br/>{extracted_data.buyer_address or ''}<br/>{extracted_data.buyer_country or ''}", normal_style)]
        ]
        t2 = Table(party_data, colWidths=[3.7*inch, 3.7*inch])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#4f46e5')),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(t2)
        elements.append(Spacer(1, 0.2*inch))

        # Item Details Header
        elements.append(Paragraph("ITEM WISE DETAILS", ParagraphStyle('IH', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10)))
        elements.append(Spacer(1, 0.1*inch))

        item_data = [
            ["S.No", "Description", "HS Code", "Quantity", "UQC", "FOB Value"]
        ]
        
        for idx, item in enumerate(extracted_data.line_items):
            item_data.append([
                str(idx + 1),
                Paragraph(item.description or "N/A", normal_style),
                item.hs_code or "N/A",
                str(item.quantity or "N/A"),
                item.unit or "NOS",
                f"{extracted_data.currency or 'USD'} {item.total_value or 0}"
            ])
            
        t3 = Table(item_data, colWidths=[0.5*inch, 3.0*inch, 1.0*inch, 0.8*inch, 0.6*inch, 1.5*inch])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(t3)
        elements.append(Spacer(1, 0.4*inch))

        # Declaration Box
        decl_text = """<b>DECLARATION:</b> I/We declare that the particulars given herein above are true and correct. I/We enclose herewith the copies of the following documents: 1. Commercial Invoice 2. Packing List. I/We undertake to abide by the provisions of Foreign Exchange Management Act, 1999, as amended from time to time."""
        decl_data = [[Paragraph(decl_text, normal_style)]]
        t4 = Table(decl_data, colWidths=[7.4*inch])
        t4.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('PADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(t4)
        
        elements.append(Spacer(1, 0.5*inch))
        
        # Signatures
        sig_data = [
            ["_______________________", "_______________________"],
            ["Customs Officer Signature", "Exporter Signature / Seal"]
        ]
        t5 = Table(sig_data, colWidths=[3.7*inch, 3.7*inch])
        t5.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, 1), 8),
        ]))
        elements.append(t5)

        doc.build(elements)
        return buffer.getvalue()
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return b"PDF Generation Error"

def generate_certificate_of_origin(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], fta_info: list) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=40, bottomMargin=40)
        elements = []
        styles = getSampleStyleSheet()

        header_style = ParagraphStyle('Header', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, alignment=1, spaceAfter=20)
        normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=9)
        
        elements.append(Paragraph("CERTIFICATE OF ORIGIN", header_style))
        elements.append(Paragraph("Issued under the relevant Free Trade Agreement (ISFTA / CEPA / ECTA)", ParagraphStyle('Sub', alignment=1, spaceAfter=30)))

        exp_name = company_profile.name if company_profile else "Not Provided"
        
        grid_data = [
            [Paragraph("<b>1. Goods consigned from (Exporter's business name, address, country)</b><br/>" + f"{exp_name}<br/>India", normal_style), 
             Paragraph(f"<b>Reference No:</b> CERT-{extracted_data.invoice_number or '001'}<br/><br/><b>PREFERENTIAL TARIFF CERTIFICATE</b>", normal_style)],
            [Paragraph("<b>2. Goods consigned to (Consignee's name, address, country)</b><br/>" + f"{extracted_data.buyer_name or 'N/A'}<br/>{extracted_data.buyer_country or ''}", normal_style),
             Paragraph("<b>For Official Use Only:</b><br/>Issued in India", normal_style)]
        ]
        
        t1 = Table(grid_data, colWidths=[3.7*inch, 3.7*inch])
        t1.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 30),
        ]))
        elements.append(t1)
        
        item_headers = ["Item No.", "Marks & Numbers", "Number and kind of packages; description of goods", "Origin Criterion", "Gross Weight"]
        item_data = [item_headers]
        
        for idx, item in enumerate(extracted_data.line_items):
            item_data.append([
                str(idx + 1),
                "N/M",
                Paragraph(item.description or "N/A", normal_style),
                "WO (Wholly Obtained)",
                f"{item.quantity or 1} {item.unit or 'KGS'}"
            ])
            
        t2 = Table(item_data, colWidths=[0.6*inch, 1.2*inch, 3.2*inch, 1.2*inch, 1.2*inch])
        t2.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(t2)

        doc.build(elements)
        return buffer.getvalue()
    except Exception as e:
        logger.error(f"COO PDF error: {e}")
        return b"Error"

def generate_end_user_undertaking(extracted_data: ExtractedData, company_profile: Optional[CompanyProfile], scomet_flags: list) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = [Paragraph("END USER UNDERTAKING (EUU)", getSampleStyleSheet()['Heading1'])]
        doc.build(elements)
        return buffer.getvalue()
    except Exception:
        return b""
