"""Generate sample customer PO PDFs for the PO capture demo: python test-data/pos/make_samples.py"""
from datetime import date, timedelta
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = Path(__file__).parent
SUPPLIER = "Shree Precision Components, Plot 42, MIDC Bhosari, Pune 411026. GSTIN 27AAXCS4210F1ZB"

SAMPLES = [
    {
        "file": "PO-Chakan-CCPL-2026-748.pdf", "buyer": "Chakan Chassis Pvt Ltd", "gstin": "27AAFCC7310P1Z8",
        "address": "Gat No. 310, Chakan Industrial Area Phase II, Pune 410501", "po": "CCPL/2026/748",
        "lines": [("ENG-512", "Engine mounting plate", 600, "pcs", 315), ("STR-330", "Steering column bracket", 400, "pcs", 260)],
        "delivery_days": 18,
    },
    {
        "file": "PO-Deccan-DAS-PO-4561.pdf", "buyer": "Deccan Auto Systems Pvt Ltd", "gstin": "27AADCD4512K1Z3",
        "address": "Plot B-12, Talegaon MIDC, Pune 410507", "po": "DAS/PO/4561",
        "lines": [("BRK-104", "Brake caliper bracket", 1500, "pcs", 182.5)],
        "delivery_days": 25,
    },
]


def build(sample: dict):
    styles = getSampleStyleSheet()
    today = date.today()
    doc = SimpleDocTemplate(str(OUT / sample["file"]), pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    rows = [["Sr", "Item Code", "Description", "Qty", "Unit", "Rate (INR)", "Amount (INR)"]]
    total = 0.0
    for idx, (code, desc, qty, unit, rate) in enumerate(sample["lines"], 1):
        amount = qty * rate
        total += amount
        rows.append([str(idx), code, desc, f"{qty:,}", unit, f"{rate:,.2f}", f"{amount:,.2f}"])
    rows.append(["", "", "Total before GST", "", "", "", f"{total:,.2f}"])
    table = Table(rows, colWidths=[24, 64, 170, 50, 36, 70, 90])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                               ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    story = [
        Paragraph(f"<b>{sample['buyer']}</b>", styles["Title"]),
        Paragraph(f"{sample['address']}<br/>GSTIN: {sample['gstin']}", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("<b>PURCHASE ORDER</b>", styles["Heading2"]),
        Paragraph(f"PO No: {sample['po']}<br/>PO Date: {today.strftime('%d-%b-%Y')}<br/>"
                  f"Delivery Date: {(today + timedelta(days=sample['delivery_days'])).strftime('%d-%b-%Y')}", styles["Normal"]),
        Spacer(1, 8),
        Paragraph(f"Vendor: {SUPPLIER}", styles["Normal"]),
        Spacer(1, 12),
        table,
        Spacer(1, 12),
        Paragraph("Terms: GST extra as applicable. Payment 45 days from invoice. Deliver to stores with test certificate.", styles["Normal"]),
    ]
    doc.build(story)


if __name__ == "__main__":
    for s in SAMPLES:
        build(s)
        print("wrote", s["file"])
