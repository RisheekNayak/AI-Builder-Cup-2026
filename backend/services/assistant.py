"""Chat assistant: Gemini with function calling over business tools, with a deterministic offline router as fallback."""
import json
import logging
import re
from datetime import date
from sqlalchemy.orm import Session
from backend.db import today
from backend.services import llm
from backend.services import assistant_tools as tools
from backend.services.assistant_tools import ToolResult
from backend.services.business_common import inr
from backend.services.deterministic import COUNTRY_ALIASES, countries_in_text


def country_name(code: str) -> str:
    names = COUNTRY_ALIASES.get(code)
    if not names:
        return code
    name = next((n for n in names if len(n) > 3), names[0])
    return code if code in ("AE", "US", "GB") else name.title()

logger = logging.getLogger(__name__)
MAX_TOOL_ROUNDS = 5

SYSTEM_PROMPT = """You are ShipSure, the business assistant for {company}, an Indian MSME manufacturer (auto components). Today is {today}.
Rules:
- Business facts (orders, dispatches, invoices, payments, stock, GST dates) come ONLY from tool results. Never invent or recompute numbers; copy amounts exactly as tools format them.
- If a tool returns an error or no data, say so plainly and suggest what the user can do.
- To record anything (payment, task, dispatch) or draft a reminder, call the matching tool. The user confirms in the app. Never say something was recorded or sent.
- Reply in the user's language. If they write Hinglish, reply in Hinglish.
- Lead with the direct answer in one sentence, then up to 4 short bullet points. Use markdown. No tables.
- "Shipped" means left the factory (a dispatch record). Delivery is not tracked; say so if asked about delivery.
- For export rules (SCOMET, FTA, documents) use policy_search and name the source.
Current screen context: {context}"""


def _merge(results: list[ToolResult]) -> dict:
    citations, actions, followups, seen = [], [], [], set()
    panel = None
    for r in results:
        for c in r.citations:
            key = (c.get("kind"), c.get("id"), c.get("label"))
            if key not in seen:
                seen.add(key)
                citations.append(c)
        actions += r.actions
        followups += [f for f in r.followups if f not in followups]
        if r.panel:
            panel = r.panel
    return {"citations": citations, "actions": actions, "followups": followups[:3], "panel": panel}


# ---------------- Gemini path ----------------

def _declarations():
    from google.genai import types
    decls = []
    for entry in tools.DECLARATIONS:
        name, description, props = entry[0], entry[1], entry[2]
        required = entry[3] if len(entry) > 3 else []
        params = {"type": "object", "properties": props, "required": required} if props else None
        decls.append(types.FunctionDeclaration(name=name, description=description, parameters_json_schema=params) if params
                     else types.FunctionDeclaration(name=name, description=description))
    return [types.Tool(function_declarations=decls)]


async def _chat_with_gemini(db: Session, messages: list[dict], context: dict | None) -> dict:
    from google.genai import types
    contents = [types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part.from_text(text=m["content"])])
                for m in messages[-12:] if m.get("content")]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.format(company=tools.company_name(), today=today().strftime("%d %b %Y"),
                                                context=json.dumps(context or {})),
        tools=_declarations(), temperature=0.2)
    results: list[ToolResult] = []
    for _ in range(MAX_TOOL_ROUNDS):
        response = await llm.generate(contents, config)
        calls = response.function_calls or []
        if not calls:
            merged = _merge(results)
            return {"reply": (response.text or "").strip() or "I could not find an answer.", "mode": "ai", **merged}
        contents.append(response.candidates[0].content)
        parts = []
        for call in calls:
            result = await tools.run_tool(db, call.name, dict(call.args or {}))
            results.append(result)
            parts.append(types.Part.from_function_response(name=call.name, response={"result": result.data}))
        contents.append(types.Content(role="tool", parts=parts))
    merged = _merge(results)
    return {"reply": "I gathered the data but could not finish the answer. The details are open beside the chat.", "mode": "ai", **merged}


# ---------------- Offline router ----------------

HINGLISH = re.compile(r"\b(kya|kitna|kitne|kaun|kab|hai|hain|nahi|nhi|bheja|bhej|gaya|paisa|paise|baaki|baki|karo|kar|mein|abhi|wala|wale|ka|ki|ko|hua|mila|aaya|dena|bata|batao|maal|kahan)\b")
GREETING = re.compile(r"^\s*(hi|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b[\s!.]*$")
HELP = re.compile(r"\b(help|what can you do|kya kar sakte)\b")
REMIND = re.compile(r"\b(remind|reminder|yaad|chase|follow ?-?up message|message bhej|whatsapp)\b")
PAY_RECORD = re.compile(r"\b(received|receive|got|mila|aaya|aa gaya|credited|record)\b.*\b(payment|paisa|paise|rs|inr|lakh|lac|amount)\b|(?:₹|rs\.?\s?)\s?\d")
TASK = re.compile(r"\b(create (a )?task|add (a )?task|task bana|assign|remind me to)\b")
DISPATCH_RECORD = re.compile(r"\b(record|log|enter|mark)\b.*\b(dispatch|dispatched|shipped)\b")
RECEIVABLE = re.compile(r"\b(owe|owes|owed|outstanding|receivable|receivables|payment|payments|paisa|paise|udhaar|udhar|collection|collect|overdue|unpaid|baaki|baki|dena hai|de raha|nahi diya|45 days?|45 din|statement|ledger|dues)\b")
ORDER = re.compile(r"\b(orders?|po|purchase order|dispatch|dispatched|ship|shipped|shipping|deliver|delivered|delivery|bheja|gaya|maal|late|delay|delayed|der|pending orders?|due this week|is hafte|this week)\b")
LATE = re.compile(r"\b(late|delay|delayed|der|behind|overdue orders?)\b")
WEEK = re.compile(r"\b(this week|is hafte|next 7 days|due soon|upcoming)\b")
STOCK = re.compile(r"\b(stock|inventory|material|shortage|shortages|reorder|khatam|kam hai|raw material|store)\b")
GST = re.compile(r"\b(gst|e-?invoice|irn|itc|itc-04|gstr|gstr-?1|gstr-?3b|tds|pf|esi|job ?work|deadline|deadlines|due dates?|compliance calendar|statutory)\b")
EXPORT = re.compile(r"\b(export|exports|shipment|shipments|scomet|fta|cepa|certificate of origin|coo|shipping bill|hs code|hsn|rodtep|drawback|e-?brc|customs|incoterm)\b")
LIST_SHIPMENTS = re.compile(r"\b(show|list|my|all|recent|history)\b.*\bshipments?\b|\bshipments? (to|for)\b")
ATTENTION = re.compile(r"\b(attention|today|aaj|summary|overview|priorit|kya karna|what should i|status of (the )?business|how is business)\b")
THIS_ORDER = re.compile(r"\b(this|is|iss|that) (order|po)\b")
THIS_CUSTOMER = re.compile(r"\b(this|is|iss|that) (customer|party|client)\b|\b(inka|unka|they|them)\b")


def _amount(text: str) -> float | None:
    t = text.lower().replace(",", "")
    best = None
    for m in re.finditer(r"(₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l|k|thousand)?\b", t):
        if not (m.group(1) or m.group(3)) and len(m.group(2)) < 4:
            continue
        value = float(m.group(2))
        unit = (m.group(3) or "")
        value *= 1e7 if unit.startswith("cr") else 1e5 if unit.startswith(("lakh", "lac")) or unit == "l" else 1e3 if unit in ("k", "thousand") else 1
        best = max(best or 0, value)
    return best


def _reply(text: str, results: list[ToolResult]) -> dict:
    return {"reply": text, "mode": "offline", **_merge(results)}


def _d(iso: str) -> str:
    return date.fromisoformat(iso).strftime("%d %b")


def _order_reply(o: dict, hinglish: bool) -> str:
    dispatches = o["dispatches"]
    head = f"**PO {o['po_number']}** ({o['customer']}): "
    if o["status"] == "dispatched":
        last = dispatches[-1]
        head += (f"poora maal bhej diya gaya hai. Last dispatch {_d(last['date'])} ko." if hinglish
                 else f"fully dispatched. Last dispatch left the factory on {_d(last['date'])}.")
    elif dispatches:
        head += (f"{o['dispatched']} of {o['ordered']} pcs bhej diye, {o['open']} pcs baaki." if hinglish
                 else f"partly dispatched: {o['dispatched']} of {o['ordered']} pcs have left the factory, {o['open']} pcs still to go.")
    else:
        head += (f"abhi tak kuch dispatch nahi hua. {o['open']} pcs pending." if hinglish
                 else f"nothing dispatched yet. {o['open']} pcs pending.")
    lines = [head, ""]
    for d in dispatches:
        lines.append(f"- {_d(d['date'])}: {d['qty']} pcs, challan {d['challan']}, vehicle {d['vehicle']} (by {d['recorded_by']})")
    if o["status"] != "dispatched":
        due = o["due_in_days"]
        lines.append(f"- Promised {_d(o['promised_date'])}: " + (f"**{-due} days late**" if due < 0 else "due today" if due == 0 else f"due in {due} days"))
    if o.get("dispatches_without_invoice"):
        lines.append(f"- {o['dispatches_without_invoice']} dispatch not invoiced yet")
    lines.append("- Delivery at the customer is not tracked; this shows factory dispatch.")
    return "\n".join(lines)


async def _chat_offline(db: Session, text: str, context: dict | None) -> dict:
    raw = text.strip()
    t = raw.lower()
    hinglish = len(HINGLISH.findall(t)) >= 2
    context = context or {}
    named = tools.customers_in_text(db, raw)
    ctx_customer = None
    if not named and THIS_CUSTOMER.search(t) and context.get("kind") == "customer" and context.get("id"):
        from backend.models.business import Customer
        ctx_customer = db.get(Customer, int(context["id"]))
    customer = named[0] if named else ctx_customer

    if GREETING.match(t) or HELP.search(t):
        return _reply("Namaste! I can answer from your factory records:\n\n- **Collections:** \"Who owes me past 45 days?\"\n"
                      "- **Orders:** \"Has PO 4512 shipped?\", \"Which orders are late?\"\n- **Actions:** \"Draft a reminder for Western Motors\", "
                      "\"Received ₹2 lakh from Chakan\"\n- **Export:** \"Is UAE covered by an FTA?\"\n- **Preview:** stock shortages and GST deadlines",
                      [ToolResult({}, followups=["What needs my attention today?", "Who owes me past 45 days?", "Which orders are late?"])])

    if TASK.search(t):
        title = re.sub(r"^.*?\b(create (a )?task|add (a )?task|task bana(o)?|assign|remind me to)\b[:\s]*(to\s+)?", "", raw, flags=re.I).strip() or raw
        role = next((r for r in ("accounts", "sales", "stores", "dispatch", "production") if r in t), "owner")
        r = tools.propose_task(db, title[:180], role, 1)
        return _reply(f"I've prepared a task for **{role}**, due tomorrow. Confirm it below.", [r])

    if REMIND.search(t) and (customer or RECEIVABLE.search(t) or "remind" in t):
        if not customer:
            top = [c for c in tools.receivables.customers_outstanding(db) if c["past_45"] > 0 or c["overdue"] > 0]
            if not top:
                return _reply("No customer has an overdue balance, so there is nothing to remind about.", [])
            name = top[0]["name"]
        else:
            name = customer.name
        r = tools.draft_reminder(db, name, "hinglish" if hinglish or "hinglish" in t or "hindi" in t else "en")
        if "error" in r.data:
            return _reply(r.data["error"], [r])
        if r.data.get("message"):
            return _reply(r.data["message"], [r])
        return _reply(f"Here is a reminder for **{r.data['customer']}** ({r.data['outstanding']} outstanding). Copy it to WhatsApp or email, "
                      "and add a follow-up task if you want one.", [r])

    if PAY_RECORD.search(t) and customer:
        amount = _amount(raw)
        if not amount:
            return _reply(f"How much did {customer.name} pay? For example: \"Received ₹2 lakh from {customer.name.split()[0]}\".", [])
        ref = re.search(r"\b(utr|ref|cheque|chq)[:\s#]*([a-z0-9]+)", t)
        r = tools.propose_payment(db, customer.name, amount, ref.group(2).upper() if ref else None)
        if "error" in r.data:
            return _reply(r.data["error"], [r])
        return _reply(f"Ready to record **{r.data['amount']}** from {r.data['customer']} (outstanding now {r.data['outstanding_before']}). "
                      "It will be applied to the oldest invoices first. Confirm below.", [r])

    if DISPATCH_RECORD.search(t):
        target = raw
        if THIS_ORDER.search(t) and context.get("kind") == "order":
            from backend.services import orders as order_service
            target = order_service.get_order(db, int(context["id"]))["po_number"]
        qty_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(pcs|pieces|nos|units)\b", t)
        r = tools.propose_dispatch(db, target, float(qty_match.group(1)) if qty_match else None)
        if "error" in r.data:
            return _reply(r.data["error"] + " Mention the PO number, e.g. \"Record dispatch of 400 pcs for PO 4512\".", [r])
        if r.data.get("message"):
            return _reply(r.data["message"], [r])
        return _reply(f"Ready to record a dispatch of **{r.data['dispatch_qty']} pcs** for PO {r.data['po_number']} "
                      f"({r.data['open_before']} pcs open). Confirm below.", [r])

    export_words = EXPORT.search(t)
    if export_words and LIST_SHIPMENTS.search(t):
        dest = countries_in_text(raw)
        r = tools.list_shipments(db, dest[0] if dest else None)
        items = r.data["shipments"]
        if not items:
            return _reply("No export shipments have been checked yet" + (f" for {country_name(dest[0])}" if dest else "") +
                          ". Upload an export invoice in New Shipment to run the compliance check.", [r])
        lines = [f"- {s['invoice']} → {s['buyer'] or 'buyer unknown'} ({s['destination'] or '?'}): {s['status']}"
                 + (f", risk **{s['risk']}**" if s["risk"] else "") for s in items[:8]]
        return _reply(f"{len(items)} export shipment{'s' if len(items) != 1 else ''} checked:\n\n" + "\n".join(lines), [r])

    # Specific order by PO number or customer + order words
    has_po_token = re.search(r"\b[a-z/-]*\d{3,}[a-z0-9/-]*\b", t)
    if (has_po_token and not PAY_RECORD.search(t)) or (THIS_ORDER.search(t) and context.get("kind") == "order"):
        query = raw
        if THIS_ORDER.search(t) and context.get("kind") == "order":
            from backend.services import orders as order_service
            query = order_service.get_order(db, int(context["id"]))["po_number"]
        r = tools.search_orders(db, query)
        if "order" in r.data:
            return _reply(_order_reply(r.data["order"], hinglish), [r])
        if "orders" in r.data:
            return _reply(f"{len(r.data['orders'])} orders match. They're listed beside the chat.", [r])

    if RECEIVABLE.search(t) and not (ORDER.search(t) and not re.search(r"\b(payment|paisa|paise|owe|outstanding)\b", t)):
        if customer:
            r = tools.customer_statement(db, customer.name)
            d = r.data
            lines = [f"**{d['customer']}** owes **{d['outstanding']}**" + (f", of which {d['past_45_days']} is past 45 days." if d["past_45_days"] != "₹0" else ".")]
            for inv in d["open_invoices"][:5]:
                lines.append(f"- {inv['number']}: {inv['balance']}, {inv['age_days']} days" + (" (past 45)" if inv["past_45"] else ""))
            if d["last_payment"]:
                lp = d["last_payment"]
                lines.append(f"- Last payment {lp['amount']} on {_d(lp['payment_date'])}")
            return _reply("\n".join(lines), [r])
        focus = "past_45" if re.search(r"\b45\b", t) else "overdue" if re.search(r"\b(overdue|late|nahi de raha|nahi diya)\b", t) else "all"
        r = tools.receivables_summary(db, focus)
        d = r.data
        if focus == "past_45":
            head = (f"**{d['past_45_days']}** {d['customers_past_45']} customers se 45 din se zyada pending hai." if hinglish
                    else f"**{d['past_45_days']}** is unpaid past 45 days, across {d['customers_past_45']} customers.")
        else:
            head = (f"Kul **{d['total_outstanding']}** baaki hai, jisme **{d['overdue']}** overdue hai." if hinglish
                    else f"Customers owe **{d['total_outstanding']}** in total; **{d['overdue']}** is overdue and {d['past_45_days']} is past 45 days.")
        lines = [head, ""]
        for c in d["customers"][:5]:
            extra = f", {c['past_45_days']} past 45 days" if c["past_45_days"] != "₹0" else ""
            lines.append(f"- **{c['name']}**: {c['outstanding']} outstanding{extra} (oldest {c['oldest_invoice_days']} days)"
                         + (" · export" if c["export_customer"] else ""))
        lines.append(f"\nCollected this month: {d['collected_this_month']}.")
        return _reply("\n".join(lines), [r])

    if STOCK.search(t) and not GST.search(t):
        r = tools.stock_shortages(db)
        s = r.data["shortages"]
        if not s:
            return _reply("All items are above their reorder level after reserving stock for open orders. (Preview data)", [r])
        lines = [f"**{len(s)} items** are below reorder level after reserving stock for open orders (preview data):", ""]
        for i in s[:6]:
            extra = f", **{i['short_for_orders']} short for open orders**" if i["short_for_orders"] != "0" else ""
            lines.append(f"- {i['code']} {i['name']}: {i['on_hand']} {i['unit']} on hand, reorder at {i['reorder_level']}{extra}")
        return _reply("\n".join(lines), [r])

    if GST.search(t) and not export_words:
        r = tools.gst_deadlines(db)
        d = r.data
        lines = ["GST and statutory dates this month (preview):", ""]
        for e in d["calendar"]:
            when = "today" if e["days_left"] == 0 else (f"{-e['days_left']} days ago" if e["days_left"] < 0 else f"in {e['days_left']} days")
            lines.append(f"- **{e['name']}** ({e['detail']}): {_d(e['due_date'])}, {when}")
        if d["einvoice_limit"]:
            lines.append("\nNear the 30-day e-invoice limit: " + ", ".join(f"{x['number']} ({max(x['days_left'], 0)} days left)" for x in d["einvoice_limit"]))
        risky = [j for j in d["job_work"] if j["status"] != "ok"]
        if risky:
            lines.append("Job-work material near or past 1 year: " + ", ".join(f"{j['challan_no']} at {j['job_worker']} ({j['age_days']} days)" for j in risky))
        return _reply("\n".join(lines), [r])

    if ORDER.search(t):
        flt = "late" if LATE.search(t) else "due_this_week" if WEEK.search(t) else "open"
        r = tools.open_orders(db, flt, customer.name if customer else None)
        d = r.data
        if not d["orders"]:
            label = {"late": "late orders", "due_this_week": "orders due this week", "open": "open orders"}[flt]
            return _reply(f"No {label}" + (f" for {d['customer']}" if d["customer"] else "") + ".", [r])
        plural = "s" if d["count"] != 1 else ""
        label = {"late": f"late order{plural}", "due_this_week": f"order{plural} due within 7 days (including late)",
                 "open": f"open order{plural}"}[flt]
        lines = [f"**{d['count']} {label}**" + (f" for {d['customer']}" if d["customer"] else "")
                 + f", worth {d['open_value']} still to dispatch:", ""]
        for o in d["orders"][:8]:
            due = o["due_in_days"]
            when = f"{-due} days late" if due < 0 else "due today" if due == 0 else f"due in {due} days"
            lines.append(f"- **{o['po_number']}** ({o['customer']}): {o['dispatched']}/{o['ordered']} pcs dispatched, {when}")
        return _reply("\n".join(lines), [r])

    if export_words or countries_in_text(raw):
        r = await tools.policy_search(raw)
        d = r.data
        lines = []
        for f in d["fta_by_country"]:
            country = country_name(f["country"])
            if f["agreements"]:
                for a in f["agreements"]:
                    lines.append(f"**{country}** is covered by **{a['name']}**. {a['benefits'] or ''}\n- Origin rule: {a['origin_criteria']}\n- Certificate: {a['certificate']}")
            else:
                lines.append(f"**{country}**: no Indian FTA in the knowledge base.")
        for k in d["knowledge_base"][:3]:
            lines.append(f"- {k.get('title') or k.get('source')}: {k.get('content', '')[:220]}")
        if not lines:
            return _reply("I couldn't find that in the export knowledge base. AI answers are unavailable right now (offline mode).", [r])
        return _reply("\n\n".join(lines[:1]) + ("\n\n" + "\n".join(lines[1:]) if len(lines) > 1 else "")
                      + "\n\n_Offline answer from the knowledge base. Verify with DGFT before filing._", [r])

    if ATTENTION.search(t):
        r = tools.today_summary(db)
        k = r.data["kpis"]
        lines = [f"Today: **{k['past_45_days']}** unpaid past 45 days, **{k['late_orders']}** late order(s), "
                 f"{k['due_this_week']} due this week.", ""]
        for i in r.data["top_items"]:
            lines.append(f"- **{i['title']}** — {i['detail']}")
        return _reply("\n".join(lines), [r])

    return _reply("I couldn't match that to your records. Try asking about money owed, a PO number, late orders, stock or GST dates.",
                  [ToolResult({}, followups=["What needs my attention today?", "Who owes me past 45 days?", "Which orders are late?"])])


async def chat(db: Session, messages: list[dict], context: dict | None = None) -> dict:
    last = next((m["content"] for m in reversed(messages) if m.get("role") == "user" and m.get("content")), "")
    if not last.strip():
        return {"reply": "Ask me about your orders, money owed, stock or GST.", "mode": "offline", "citations": [], "actions": [],
                "followups": [], "panel": None}
    if llm.enabled():
        try:
            return await _chat_with_gemini(db, messages, context)
        except llm.LLMUnavailable:
            pass
        except Exception:  # never fail the chat because of the AI layer
            logger.exception("Assistant AI path failed")
    result = await _chat_offline(db, last, context)
    result["notice"] = "AI is unavailable, so answers come from fixed rules over your records."
    return result


async def reminder_with_ai(statement: dict, language: str, company: str) -> tuple[str, str]:
    """Returns (text, mode). Falls back to the template when AI is unavailable."""
    template = tools.receivables.reminder_text(statement, language, company)
    if not llm.enabled():
        return template, "template"
    prompt = (f"Rewrite this payment reminder to sound polite and personal for an Indian B2B customer. Keep every invoice number, "
              f"amount and date exactly as written. {'Write in Hinglish (Roman script).' if language == 'hinglish' else 'Write in English.'} "
              f"Return only the message.\n\n{template}")
    try:
        text = await llm.generate_text(prompt)
        amounts = re.findall(r"₹[\d,]+", template)
        if text and all(a in text for a in amounts):
            return text, "ai"
    except llm.LLMUnavailable:
        pass
    return template, "template"


__all__ = ["chat", "reminder_with_ai", "inr"]
