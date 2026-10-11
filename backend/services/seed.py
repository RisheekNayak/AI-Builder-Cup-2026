"""Sample factory: Shree Precision Components, Pune. All dates are relative to today so the demo stays current."""
from datetime import timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.db import Base, engine, today
from backend.models.business import (Customer, Dispatch, DispatchLine, Invoice, Item, JobWorkChallan, OrderLine, Payment,
                                     SalesOrder, Task)
from backend.services.business_common import fy_label
from backend.services.orders import GST_RATE

CUSTOMERS = [
    ("deccan", "Deccan Auto Systems Pvt Ltd", "27AADCD4512K1Z3", "Pune", "IN", 45, "Mr. Kulkarni", "+91 98220 41512"),
    ("western", "Western Motors Ltd", "27AAACW8821M1ZQ", "Nashik", "IN", 60, "Ms. Deshpande", "+91 98500 88213"),
    ("chakan", "Chakan Chassis Pvt Ltd", "27AAFCC7310P1Z8", "Chakan", "IN", 45, "Mr. Patil", "+91 97660 73100"),
    ("kaveri", "Kaveri Brake Linings Ltd", "33AABCK5520R1Z1", "Chennai", "IN", 30, "Mr. Raghavan", "+91 94440 55200"),
    ("gujarat", "Gujarat Gear Traders", "24AAJFG1190L1ZK", "Ahmedabad", "IN", 30, "Mr. Shah", "+91 98250 11900"),
    ("gulf", "Gulf Auto Parts LLC", None, "Dubai", "AE", 60, "Mr. Rahman", "+971 50 330 7000"),
]

ITEMS = [
    ("BRK-104", "Brake caliper bracket", "87083000", "pcs", 185, 3400, 800, "finished"),
    ("BRK-210", "Brake disc spacer", "87083000", "pcs", 42, 7600, 3000, "finished"),
    ("STR-330", "Steering column bracket", "87089900", "pcs", 260, 400, 600, "finished"),
    ("ENG-512", "Engine mounting plate", "87089900", "pcs", 315, 1500, 500, "finished"),
    ("GER-118", "Spur gear 18T", "84834000", "pcs", 520, 600, 250, "finished"),
    ("SHF-220", "Drive shaft sleeve", "84833000", "pcs", 410, 1700, 400, "finished"),
    ("FST-900", "Hex flange bolt M10 kit", "73181500", "pcs", 18, 41000, 20000, "finished"),
    ("RM-CRS-2", "CR steel sheet 2 mm", "72091600", "kg", 68, 1800, 3000, "raw"),
    ("RM-AL-6061", "Aluminium bar 6061", "76042910", "kg", 290, 950, 800, "raw"),
    ("RM-EN8-40", "EN8 round bar 40 mm", "72142090", "kg", 72, 600, 1500, "raw"),
    ("RM-PWD-BLK", "Powder coat, black", "32089090", "kg", 340, 220, 150, "raw"),
    ("RM-BOX-5P", "Corrugated box, 5-ply", "48191010", "nos", 24, 1500, 1000, "raw"),
]

# key, customer, PO number, PO date offset, promised offset, lines [(item, qty)], dispatches [(offset, {item: qty}, challan, invoice?)]
ORDERS = [
    ("o4498", "deccan", "DAS/PO/4498", -70, -50, [("BRK-104", 3000)], [(-52, {"BRK-104": 1500}, "DC-2211", True), (-49, {"BRK-104": 1500}, "DC-2218", True)]),
    ("o87990", "western", "WML-87990", -90, -65, [("ENG-512", 1200)], [(-66, {"ENG-512": 1200}, "DC-2187", True)]),
    ("o702", "chakan", "CCPL/2026/702", -75, -56, [("STR-330", 1000)], [(-58, {"STR-330": 1000}, "DC-2205", True)]),
    ("o5520", "kaveri", "KBL-5520", -50, -25, [("BRK-210", 6000)], [(-30, {"BRK-210": 3000}, "DC-2240", True), (-28, {"BRK-210": 3000}, "DC-2244", True)]),
    ("o119", "gujarat", "GGT/119", -40, -20, [("GER-118", 400)], [(-26, {"GER-118": 400}, "DC-2251", True)]),
    ("o88213", "western", "WML-88213", -35, -4, [("STR-330", 1500)], [(-10, {"STR-330": 900}, "DC-2266", True)]),
    ("o4512", "deccan", "DAS/PO/4512", -20, 2, [("BRK-104", 1000), ("BRK-210", 4000)], [(-3, {"BRK-104": 600}, "DC-2271", False)]),
    ("o731", "chakan", "CCPL/2026/731", -15, 3, [("ENG-512", 800)], []),
    ("o3307", "gulf", "GAP-PO-3307", -30, 12, [("SHF-220", 1200), ("BRK-104", 2000)], []),
    ("o5601", "kaveri", "KBL-5601", -5, 20, [("FST-900", 20000)], []),
    ("o4530", "deccan", "DAS/PO/4530", -6, 6, [("GER-118", 300)], []),
]

NO_IRN = {"DC-2244", "DC-2251"}  # e-invoice not yet generated (GST preview)
PAYMENTS = [  # challan, offset, amount (None = full), reference
    ("DC-2211", -20, 200000, "UTR HDFC 4471"),
    ("DC-2205", -15, 153400, "UTR ICIC 9921"),
    ("DC-2240", -2, None, "UTR SBIN 3310"),
]


def reset_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def seed(db: Session):
    t = today()
    customers = {key: Customer(name=name, gstin=gstin, city=city, country=country, credit_days=credit, contact_name=contact,
                               whatsapp=phone, source="seed")
                 for key, name, gstin, city, country, credit, contact, phone in CUSTOMERS}
    items = {code: Item(code=code, name=name, hsn=hsn, unit=unit, rate=rate, on_hand=on_hand, reorder_level=reorder, kind=kind, source="seed")
             for code, name, hsn, unit, rate, on_hand, reorder, kind in ITEMS}
    db.add_all([*customers.values(), *items.values()])
    db.flush()

    invoice_seq = 101
    invoices_by_challan: dict[str, Invoice] = {}
    order_ids: dict[str, int] = {}
    for key, cust_key, po, po_off, promise_off, lines, dispatches in ORDERS:
        order = SalesOrder(customer_id=customers[cust_key].id, po_number=po, po_date=t + timedelta(days=po_off),
                           promised_date=t + timedelta(days=promise_off), source="seed")
        line_by_code = {}
        for code, quantity in lines:
            line = OrderLine(item_id=items[code].id, description=items[code].name, qty=quantity, rate=items[code].rate)
            order.lines.append(line)
            line_by_code[code] = line
        db.add(order)
        db.flush()
        order_ids[key] = order.id
        for off, shipped, challan, invoiced in dispatches:
            day = t + timedelta(days=off)
            dispatch = Dispatch(order_id=order.id, dispatch_date=day, challan_no=challan, vehicle_no="MH-12-" + challan[-4:],
                                eway_bill_no=f"3412{challan[-4:]}0987", recorded_by="Priya (Dispatch)", source="seed")
            value = 0.0
            for code, quantity in shipped.items():
                dispatch.lines.append(DispatchLine(order_line_id=line_by_code[code].id, qty=quantity))
                value += quantity * line_by_code[code].rate
            db.add(dispatch)
            db.flush()
            if invoiced:
                invoice = Invoice(customer_id=order.customer_id, order_id=order.id, dispatch_id=dispatch.id,
                                  number=f"SPC/{fy_label(day)}/{invoice_seq:04d}", invoice_date=day,
                                  amount=round(value * (1 + GST_RATE), 2), irn_generated=challan not in NO_IRN, source="seed")
                invoice_seq += 1
                db.add(invoice)
                invoices_by_challan[challan] = invoice
    db.flush()

    # Older invoices not linked to the current order book.
    old_paid = Invoice(customer_id=customers["gujarat"].id, number=f"SPC/{fy_label(t - timedelta(days=95))}/0087",
                       invoice_date=t - timedelta(days=95), amount=180000, irn_generated=True, source="seed")
    export_invoice = Invoice(customer_id=customers["gulf"].id, number=f"SPC/EXP/{fy_label(t - timedelta(days=80))}/0007",
                             invoice_date=t - timedelta(days=80), amount=1250000, irn_generated=True, source="seed")
    db.add_all([old_paid, export_invoice])
    db.flush()
    db.add(Payment(customer_id=old_paid.customer_id, invoice_id=old_paid.id, payment_date=t - timedelta(days=60),
                   amount=180000, reference="UTR KKBK 1180", source="seed"))
    for challan, off, amount, ref in PAYMENTS:
        inv = invoices_by_challan[challan]
        db.add(Payment(customer_id=inv.customer_id, invoice_id=inv.id, payment_date=t + timedelta(days=off),
                       amount=inv.amount if amount is None else amount, reference=ref, source="seed"))

    db.add_all([
        JobWorkChallan(challan_no="JW/092", job_worker="Chakan Coaters", process="Powder coating", item_id=items["STR-330"].id,
                       sent_date=t - timedelta(days=372), qty_sent=1000, qty_returned=800, source="seed"),
        JobWorkChallan(challan_no="JW/104", job_worker="Shiv Plating Works", process="Zinc plating", item_id=items["BRK-104"].id,
                       sent_date=t - timedelta(days=300), qty_sent=2000, qty_returned=1400, source="seed"),
        JobWorkChallan(challan_no="JW/131", job_worker="Bhosari Heat Treatment", process="Hardening", item_id=items["GER-118"].id,
                       sent_date=t - timedelta(days=40), qty_sent=500, qty_returned=300, source="seed"),
        Task(title="Confirm vehicle for the remaining DAS/PO/4512 dispatch", assignee_role="dispatch", due_date=t,
             entity_type="order", entity_id=str(order_ids["o4512"]), source="seed"),
    ])
    db.commit()


def seed_if_empty(db: Session):
    if not db.scalars(select(Customer).limit(1)).first():
        seed(db)


def reset_and_seed(db: Session):
    db.close()
    reset_database()
    seed(db)
