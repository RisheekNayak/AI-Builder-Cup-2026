from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).parent.parent.parent


def _customer_id(client, name_part):
    customers = client.get("/api/receivables/summary").json()["customers"]
    return next(c["customer_id"] for c in customers if name_part in c["name"])


def _order(client, po):
    orders = client.get("/api/orders/?status=all").json()["orders"]
    return next(o for o in orders if o["po_number"] == po)


def test_debug_endpoint_removed(client):
    assert client.get("/debug").status_code == 404


def test_receivables_ageing_and_45_day_rule(client):
    s = client.get("/api/receivables/summary").json()
    assert s["past_45"] == pytest.approx(1054340)
    assert s["past_45_customers"] == 3
    assert sum(b["amount"] for b in s["buckets"]) == pytest.approx(s["total_outstanding"])
    gulf = next(c for c in s["customers"] if c["country"] == "AE")
    assert gulf["overdue"] > 0 and gulf["past_45"] == 0  # 45-day rule applies to domestic buyers only


def test_payment_applies_to_oldest_invoice_first(client):
    deccan = _customer_id(client, "Deccan")
    before = client.get(f"/api/receivables/customers/{deccan}").json()
    oldest = next(i for i in before["invoices"] if i["status"] != "paid")
    r = client.post("/api/receivables/payments", json={"customer_id": deccan, "amount": 200000, "reference": "UTR1"})
    assert r.status_code == 200
    alloc = r.json()["allocations"]
    assert alloc[0]["invoice_number"] == oldest["number"] and alloc[0]["amount"] == pytest.approx(oldest["balance"])
    assert sum(a["amount"] for a in alloc) == pytest.approx(200000)
    after = r.json()["statement"]
    assert after["outstanding"] == pytest.approx(before["outstanding"] - 200000)


def test_payment_above_outstanding_is_rejected(client):
    chakan = _customer_id(client, "Chakan")
    r = client.post("/api/receivables/payments", json={"customer_id": chakan, "amount": 9_000_000})
    assert r.status_code == 400 and "outstanding" in r.json()["detail"]


def test_dispatch_updates_status_and_creates_invoice(client):
    order = _order(client, "WML-88213")
    assert order["status"] == "late" and order["open_qty"] == 600
    line = order["lines"][0]
    too_many = client.post(f"/api/orders/{order['id']}/dispatches", json={"lines": [{"order_line_id": line["id"], "qty": 601}]})
    assert too_many.status_code == 400
    r = client.post(f"/api/orders/{order['id']}/dispatches", json={"lines": [{"order_line_id": line["id"], "qty": 600}], "challan_no": "DC-9001"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "dispatched" and body["open_qty"] == 0
    assert body["new_invoice"]["amount"] == pytest.approx(600 * 260 * 1.18)
    titles = [i["title"] for i in client.get("/api/inbox/today").json()["items"]]
    assert not any("WML-88213" in t and "late" in t for t in titles)


def test_create_order_and_reject_duplicate(client):
    masters = client.get("/api/orders/masters").json()
    payload = {"customer_id": masters["customers"][0]["id"], "po_number": "TEST-1", "po_date": "2026-01-01",
               "promised_date": "2026-02-01", "lines": [{"item_id": masters["items"][0]["id"], "qty": 10}]}
    assert client.post("/api/orders/", json=payload).status_code == 200
    assert client.post("/api/orders/", json=payload).status_code == 400


def test_inbox_prioritises_money_and_late_orders(client):
    inbox = client.get("/api/inbox/today").json()
    kinds = [i["kind"] for i in inbox["items"]]
    assert inbox["items"][0]["severity"] == "critical"
    assert {"collection", "order", "invoice", "stock", "gst", "export"} <= set(kinds)
    assert inbox["kpis"]["late_orders"] == 1


def test_stock_and_gst_preview(client):
    shortages = client.get("/api/stock").json()["shortages"]
    assert {"STR-330", "RM-CRS-2", "RM-EN8-40"} == {s["code"] for s in shortages}
    gst = client.get("/api/gst").json()
    assert len(gst["irn_guard"]) == 2
    assert any(j["status"] == "deemed_supply" for j in gst["job_work"])


@pytest.mark.parametrize("question, panel_kind, action", [
    ("Who owes me past 45 days?", "receivables", None),
    ("kaun paisa nahi de raha hai?", "receivables", None),
    ("Has PO 4512 shipped?", "order", None),
    ("4512 ka maal gaya kya?", "order", None),
    ("Which orders are late?", "orders", None),
    ("orders due this week", "orders", None),
    ("Show Western Motors statement", "customer", None),
    ("Draft a reminder for Western Motors in hinglish", "customer", "reminder"),
    ("Received ₹1 lakh from Chakan", "customer", "record_payment"),
    ("Record dispatch of 400 pcs for PO 4512", "order", "record_dispatch"),
    ("stock shortages", "stock", None),
    ("GST deadlines this month", "gst", None),
    ("show shipments to UAE", "history", None),
    ("create task to call Deccan accounts", None, "create_task"),
])
def test_offline_assistant_routing(client, question, panel_kind, action):
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": question}]}).json()
    assert r["mode"] == "offline"
    assert (r["panel"] or {}).get("kind") == panel_kind
    if action:
        assert action in [a["type"] for a in r["actions"]]


def test_assistant_answers_with_database_numbers(client):
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "Who owes me past 45 days?"}]}).json()
    assert "₹10,54,340" in r["reply"]
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "Has PO 4512 shipped?"}]}).json()
    assert "600 of 5,000" in r["reply"]


def test_fta_aliases_and_lookups():
    from backend.services.deterministic import check_fta_eligibility, load_data, lookup_hs_code, lookup_port
    load_data()
    assert check_fta_eligibility("United Arab Emirates") and check_fta_eligibility("UAE") and check_fta_eligibility("AE")
    assert lookup_hs_code("8708.30.00")["hs_code"] == "87083000"
    assert lookup_port("innsa1")["name"].startswith("Nhava Sheva")


def test_unreadable_upload_is_an_error_not_sample_data(client):
    r = client.post("/api/upload/", files={"file": ("scomet-invoice.pdf", b"%PDF-1.4 not really", "application/pdf")}).json()
    assert r["status"] == "error" and "unavailable" in r["error"]
    shipment = client.get(f"/api/upload/shipments/{r['shipment_id']}").json()
    assert shipment["extracted_data"] is None


def test_sample_invoice_rules_report_and_forms(client):
    r = client.post("/api/upload/sample/fta-eligible").json()
    assert r["status"] == "complete"
    sid = r["shipment_id"]
    shipment = client.get(f"/api/upload/shipments/{sid}").json()
    assert shipment["risk_report"]["mode"] == "rules" and shipment["fta_matches"]
    assert client.post(f"/api/forms/{sid}/generate").status_code == 200
    forms = {f["id"]: f["status"] for f in client.get(f"/api/forms/{sid}/forms").json()["forms"]}
    assert forms["shipping_bill"] == "generated" and forms["coo"] == "generated"
    pdf = client.get(f"/api/forms/{sid}/forms/coo/download")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_scomet_sample_lists_euu_as_unsupported(client):
    sid = client.post("/api/upload/sample/scomet-flag").json()["shipment_id"]
    shipment = client.get(f"/api/upload/shipments/{sid}").json()
    assert shipment["scomet_flags"] and shipment["risk_report"]["overall_score"] == "critical"
    forms = {f["id"]: f["status"] for f in client.get(f"/api/forms/{sid}/forms").json()["forms"]}
    assert forms["euu"] == "unsupported"


def test_edit_extracted_data_reruns_analysis(client):
    sid = client.post("/api/upload/sample/clean-pass").json()["shipment_id"]
    data = client.get(f"/api/extraction/{sid}").json()["extracted_data"]
    data["buyer_country"] = "United Arab Emirates"
    updated = client.patch(f"/api/extraction/{sid}", json=data).json()
    assert updated["status"] == "complete" and updated["fta_matches"]


def test_po_capture_rules_mode(client):
    pdf = (PROJECT_ROOT / "test-data" / "pos" / "PO-Chakan-CCPL-2026-748.pdf").read_bytes()
    draft = client.post("/api/orders/capture", files={"file": ("po.pdf", pdf, "application/pdf")}).json()
    assert draft["mode"] == "rules"
    assert draft["customer_name"] == "Chakan Chassis Pvt Ltd" and draft["po_number"] == "CCPL/2026/748"
    assert [(l["item_code"], l["qty"], l["rate"]) for l in draft["lines"]] == [("ENG-512", 600, 315), ("STR-330", 400, 260)]
    assert draft["promised_date"]
